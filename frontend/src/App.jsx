import React, { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { Toaster, toast } from 'sonner';
import { Shield, ShieldOff, Timer as TimerIcon, Trophy, User, Zap } from 'lucide-react';

import PlayerInfo from './components/PlayerInfo';
import Timer from './components/Timer';
import Leaderboard from './components/Leaderboard';
import OfferCard from './components/Card';

// --- Zustand Store for State Management ---
const useGameStore = create((set, get) => ({
  socket: null,
  connectionStatus: 'disconnected',
  player: null,
  cards: [],
  roundEndsAt: null,
  leaderboard: [],
  feedback: {}, // { cardId: { correct, correct_label, score_change } }
  totalScore: 0,

  connect: () => {
    let player = get().player;
    if (!player) {
      const adjectives = [
        "Ágil", "Brilhante", "Feroz", "Sagaz", "Ávido", "Intrépido", "Astuto",
        "Vibrante", "Sutil", "Cauteloso", "Destemido", "Elegante", "Perspicaz",
        "Silencioso", "Rápido", "Observador", "Atento", "Leal", "Valente",
        "Imparável", "Intenso", "Sábio", "Inventivo", "Tenaz", "Criativo",
        "Visionário", "Fortíssimo", "Prudente", "Seguro", "Explosivo", "Versátil",
        "Resiliente", "Confiável", "Arrojado", "Notável", "Bravio", "Astro",
        "Potente", "Destacado", "Formidável", "Habilidoso", "Ligeiro",
        "Inabalável", "Fulgaz", "Radiante", "Supremo", "Audaz", "Héroico",
        "Genial", "Áureo"
      ];
      const emojis = [
        "⚡️","🔥","🌪️","🌊","🌟","☀️","🌙","⭐️","🌈","❄️",
        "🦊","🦁","🐺","🐯","🦅","🦉","🕵️","🐉","🐍","🦂",
        "🦖","🦕","🐦","🐧","🐬","🐳","🦈","🐎","🦓","🦌",
        "🐒","🦍","🐼","🐨","🐯","🐲","🦩","🦜","🦢","🕊️",
        "🦦","🐾","🎯","🛡️","⚔️","🏹","🚀","🎩","👑","💎"
      ];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      player = {
        id: localStorage.getItem('playerId') || `player_${uuidv4()}`,
        nickname: `${randomAdj} ${randomEmoji}`
      };
      localStorage.setItem('playerId', player.id);
      set({ player });
    }

    const wsUrl = import.meta.env.VITE_API_URL || 'ws://localhost:8000/ws';
    const socket = new WebSocket(`${wsUrl}/${player.id}/${encodeURIComponent(player.nickname)}`);

    socket.onopen = () => {
      set({ connectionStatus: 'connected' });
      toast.success('Conectado ao servidor do jogo!');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'new_round':
        case 'game_state':
          set({ 
            cards: data.cards, 
            roundEndsAt: data.expires_at,
            feedback: {}, // Reset feedback for new round
            leaderboard: data.leaderboard || get().leaderboard
          });
          toast.info('Nova rodada começou!');
          break;
        case 'leaderboard_update':
          set({ leaderboard: data.leaderboard });
          break;
        case 'feedback':
          set(state => ({
            feedback: { ...state.feedback, [data.card_id]: { ...data } },
            totalScore: data.new_total_score
          }));
          if (data.correct) {
            toast.success(`Acertou! +${data.score_change} pontos.`);
          } else {
            toast.error(`Errou! ${data.score_change} pontos.`);
          }
          break;
        case 'round_end':
            set({ roundEndsAt: null, cards: [] });
            toast.info("A rodada terminou! Calculando resultados...");
            break;
        case 'error':
            toast.warning(`Aviso: ${data.message}`);
            break;
      }
    };

    socket.onclose = () => {
      set({ connectionStatus: 'disconnected' });
      toast.error('Desconectado do servidor. Tentando reconectar...');
      setTimeout(() => get().connect(), 5000); // Reconnect logic
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      toast.error('Erro de conexão com o servidor.');
      socket.close();
    };

    set({ socket });
  },

  sendAction: (cardId, action) => {
    const { socket, connectionStatus } = get();
    if (socket && connectionStatus === 'connected') {
      socket.send(JSON.stringify({ action, card_id: cardId }));
    }
  },
}));

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


// --- Main App Component ---
export default function App() {
  const { connect, connectionStatus, player, cards, roundEndsAt, leaderboard, feedback, totalScore, sendAction } = useGameStore();

  useEffect(() => {
    connect();
  }, [connect]);
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  useEffect(() => {
    // Quando uma nova rodada começa (cards mudam), resetar para o primeiro card.
    setCurrentCardIndex(0);
  }, [cards])

  const handleAction = (cardId, action) => {
    sendAction(cardId, action);
    // Avança para o próximo card após a ação
    setTimeout(() => {
        if(currentCardIndex < cards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        }
    }, 300); // Pequeno delay para o usuário ver o feedback visual
  };

  const currentCard = useMemo(() => cards[currentCardIndex], [cards, currentCardIndex]);

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 flex flex-col lg:flex-row gap-4">
        
        {/* Left Panel / Main Game Area */}
        <main className="flex-grow flex flex-col gap-4 items-center">
          <header className="w-full max-w-4xl flex justify-between items-center bg-gray-800/50 p-3 rounded-lg">
            <h1 className="text-2xl font-bold text-yellow-400">Caça-Pirata Express 🏴‍☠️</h1>
            <div className="flex items-center gap-4">
                <PlayerInfo player={player} totalScore={totalScore} connectionStatus={connectionStatus} />
                {roundEndsAt && <Timer expiryTimestamp={roundEndsAt} />}
            </div>
          </header>

          <div className="w-full max-w-4xl flex-grow flex flex-col items-center justify-center p-4 bg-black/20 rounded-lg">
            {connectionStatus !== 'connected' && (
                <div className="text-center">
                    <p className="text-xl animate-pulse">Conectando ao servidor...</p>
                </div>
            )}
            {connectionStatus === 'connected' && cards.length === 0 && (
                <div className="text-center">
                    <p className="text-2xl font-bold mb-2">Aguardando nova rodada...</p>
                    <p className="text-gray-400">O próximo jogo começará em breve!</p>
                </div>
            )}
            {currentCard && (
              <div className="w-full flex flex-col items-center gap-4 animate-reveal">
                <OfferCard 
                  card={currentCard} 
                  feedback={feedback[currentCard.id]} 
                />
                 <div className="flex gap-4 mt-4">
                  <button 
                    onClick={() => handleAction(currentCard.id, 'denounce')}
                    disabled={!!feedback[currentCard.id]}
                    className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed">
                    <ShieldOff /> Denunciar
                  </button>
                  <button 
                    onClick={() => handleAction(currentCard.id, 'approve')}
                    disabled={!!feedback[currentCard.id]}
                    className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed">
                    <Shield /> Aprovar
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">Card {currentCardIndex + 1} de {cards.length}</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel / Leaderboard */}
        <aside className="w-full lg:w-80 lg:flex-shrink-0">
          <Leaderboard leaderboard={leaderboard} />
        </aside>
      </div>
    </>
  );
}
