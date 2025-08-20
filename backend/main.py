import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set

import redis.asyncio as redis
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

# --- Basic Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()

# --- Environment Variables & Constants ---
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ROUND_DURATION_SECONDS = 60
CARD_COUNT = 20
LEADERBOARD_KEY = "leaderboard"
COOLDOWN_SECONDS = 0.3

# --- Pydantic Models for Data Structure ---
class OfferCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product: str
    brand: str
    priceBRL: float
    originalPriceBRL: Optional[float] = None
    shippingInfo: str
    description: str
    photos: int
    signals: List[str]
    label: str  # "legitimo" or "pirata"
    difficulty: int

class GameState:
    def __init__(self):
        self.cards: List[OfferCard] = []
        self.round_end_time: Optional[datetime] = None
        self.lock = asyncio.Lock()

    def is_round_active(self) -> bool:
        return self.round_end_time is not None and datetime.utcnow() < self.round_end_time

    def get_time_remaining(self) -> int:
        if not self.is_round_active():
            return 0
        return int((self.round_end_time - datetime.utcnow()).total_seconds())

# --- Application Initialization ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
game_state = GameState()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.last_click_time: Dict[str, datetime] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected.")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.last_click_time:
            del self.last_click_time[client_id]
        logger.info(f"Client {client_id} disconnected.")

    def is_on_cooldown(self, client_id: str) -> bool:
        now = datetime.utcnow()
        last_click = self.last_click_time.get(client_id)
        if last_click and (now - last_click).total_seconds() < COOLDOWN_SECONDS:
            return True
        self.last_click_time[client_id] = now
        return False

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        # Create a list of tasks to send messages concurrently
        tasks = [
            ws.send_json(message) for ws in self.active_connections.values()
        ]
        # Gather will run all tasks in parallel
        await asyncio.gather(*tasks, return_exceptions=True)


manager = ConnectionManager()


# --- OpenAI Card Generation ---
async def generate_cards_from_openai(num_cards: int) -> List[OfferCard]:
    logger.info("Generating new cards from OpenAI...")
    prompt = {
        "system": """
        Você é um gerador de cards de ofertas para um jogo web sobre combate à pirataria.
        Responda APENAS com JSON válido UTF-8, sem comentários, sem markdown.
        Siga rigorosamente o schema:
        OfferCard = {
            "id": string (uuid),
            "product": "camiseta"|"tênis"|"boné"|"jaqueta"|"meias"|"shorts",
            "brand": string,
            "priceBRL": number,
            "originalPriceBRL": number|null,
            "shippingInfo": string,
            "description": string,
            "photos": number,
            "signals": string[],
            "label": "legitimo"|"pirata",
            "difficulty": 1|2|3
        }
        Retorne um objeto {"cards": OfferCard[]} com exatamente N cards.
        Balanceie 50% legítimo / 50% pirata e distribua difficulty (1:50%, 2:35%, 3:15%).
        Evite marcas reais.
        """,
        "user": f"""
        Gere N={num_cards} cards variados e coesos com o tema "vestuário esportivo" no Brasil.
        Critérios de "pirata":
        - preço >=60% menor que originalPriceBRL OU indícios textuais claros ("réplica", "prime linha", "garantia do vendedor", ortografia errada, logotipo alterado).
        - shippingInfo suspeito ou vago (sem rastreio, “internacional rápido”).
        Critérios de "legitimo":
        - preço entre 70% e 100% do originalPriceBRL (ou priceBRL realista sem original).
        - descrição clara, sem erros, shippingInfo coerente (prazo, rastreio).
        Regras:
        - priceBRL entre 20 e 900 para camisetas/bonés/meias; até 1500 para tênis/jaqueta.
        - description em pt-BR.
        - signals deve apontar PISTAS REAIS do próprio card (coerentes com o texto).
        - fotos: 0–3 (não gere URLs).
        - Não use marcas reais.
        Retorne apenas {{"cards":[...]}}.
        """
    }
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt["system"]},
                {"role": "user", "content": prompt["user"]},
            ],
            response_format={"type": "json_object"},
            temperature=1.1,
        )
        content = response.choices[0].message.content
        card_data = json.loads(content)
        cards = [OfferCard(**card) for card in card_data["cards"]]
        logger.info(f"Successfully generated {len(cards)} cards.")
        return cards
    except Exception as e:
        logger.error(f"Error generating cards from OpenAI: {e}")
        # Fallback to a single dummy card in case of API failure
        return [OfferCard(
            id=str(uuid.uuid4()), product="camiseta", brand="Fallback Brand",
            priceBRL=50, originalPriceBRL=100, shippingInfo="Erro na API",
            description="Falha ao contatar a API da OpenAI.", photos=0,
            signals=["API Error"], label="pirata", difficulty=1
        )]

# --- Leaderboard Logic ---
async def get_leaderboard(top_n: int = 10) -> List[Dict]:
    scores = await redis_client.zrevrange(LEADERBOARD_KEY, 0, top_n - 1, withscores=True)
    return [{"nickname": member.split(":")[1], "score": int(score)} for member, score in scores]

async def update_score(client_id: str, nickname: str, score_change: int):
    member = f"{client_id}:{nickname}"
    # Use ZINCRBY to atomically update the score. It returns the new score.
    new_score = await redis_client.zincrby(LEADERBOARD_KEY, score_change, member)
    return new_score

# --- Game Logic ---
def calculate_score(guess: str, card: OfferCard) -> int:
    correct_label = card.label
    is_correct = guess == correct_label

    if is_correct:
        # Reward based on difficulty
        base_score = {1: 30, 2: 60, 3: 100}.get(card.difficulty, 30)
        time_left = game_state.get_time_remaining()
        # Bonus for speed, maxing out the base_score
        time_bonus = int(base_score * (time_left / ROUND_DURATION_SECONDS))
        return base_score + time_bonus
    else:
        # Penalty based on difficulty
        return {-1: -20, -2: -30, -3: -40}.get(card.difficulty, -20)

async def start_new_round():
    async with game_state.lock:
        logger.info("Starting new round...")
        
        # Reset leaderboard for the new round
        await redis_client.delete(LEADERBOARD_KEY)

        game_state.cards = await generate_cards_from_openai(CARD_COUNT)
        game_state.round_end_time = datetime.utcnow() + timedelta(seconds=ROUND_DURATION_SECONDS)
        
        # Announce new round to everyone
        await manager.broadcast({
            "type": "new_round",
            "cards": [card.model_dump() for card in game_state.cards],
            "expires_at": game_state.round_end_time.isoformat()
        })
        logger.info("New round broadcasted to all clients.")

async def game_loop():
    while True:
        await start_new_round()
        await asyncio.sleep(ROUND_DURATION_SECONDS)
        
        logger.info("Round ended. Broadcasting final leaderboard.")
        final_leaderboard = await get_leaderboard()
        await manager.broadcast({"type": "round_end", "leaderboard": final_leaderboard})
        
        # Short pause before starting the next round
        await asyncio.sleep(5)


# --- WebSocket Endpoint ---
@app.websocket("/ws/{client_id}/{nickname}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, nickname: str):
    await manager.connect(websocket, client_id)
    
    # Send current game state to the new client
    async with game_state.lock:
        if game_state.is_round_active():
            await websocket.send_json({
                "type": "game_state",
                "cards": [card.model_dump() for card in game_state.cards],
                "expires_at": game_state.round_end_time.isoformat()
            })
    
    # Send current leaderboard
    leaderboard = await get_leaderboard()
    await websocket.send_json({"type": "leaderboard_update", "leaderboard": leaderboard})

    try:
        while True:
            data = await websocket.receive_json()
            # Basic validation
            if "action" not in data or "card_id" not in data:
                continue

            if not game_state.is_round_active():
                await websocket.send_json({"type": "error", "message": "Round not active."})
                continue
            
            if manager.is_on_cooldown(client_id):
                await websocket.send_json({"type": "error", "message": "Cooldown active."})
                continue

            card_id = data["card_id"]
            action = data["action"]  # "approve" or "denounce"
            guess = "legitimo" if action == "approve" else "pirata"

            card = next((c for c in game_state.cards if c.id == card_id), None)

            if card:
                score_change = calculate_score(guess, card)
                new_score = await update_score(client_id, nickname, score_change)
                
                # Send personal feedback to the player
                await websocket.send_json({
                    "type": "feedback",
                    "card_id": card_id,
                    "correct": score_change > 0,
                    "correct_label": card.label,
                    "score_change": score_change,
                    "new_total_score": new_score
                })

                # Broadcast updated leaderboard to everyone
                leaderboard = await get_leaderboard()
                await manager.broadcast({"type": "leaderboard_update", "leaderboard": leaderboard})

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected.")
    except Exception as e:
        logger.error(f"Error in WebSocket for client {client_id}: {e}")
        manager.disconnect(client_id)


# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    # Ping Redis to ensure connection
    try:
        await redis_client.ping()
        logger.info("Successfully connected to Redis.")
    except Exception as e:
        logger.error(f"Could not connect to Redis: {e}")
        # Depending on the policy, you might want to exit if Redis is not available
        # sys.exit(1)

    # Start the main game loop in the background
    asyncio.create_task(game_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
