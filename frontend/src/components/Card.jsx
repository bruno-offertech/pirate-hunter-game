import React from 'react';
import { Tag, DollarSign, Truck, AlertTriangle, FileText, ImageIcon, CheckCircle, XCircle } from 'lucide-react';

const OfferCard = ({ card, feedback }) => {

  const isLegit = card.label === 'legitimo';
  const revealed = !!feedback;
  const wasCorrect = feedback?.correct;

  const difficultyColors = {
    1: 'border-green-500',
    2: 'border-yellow-500',
    3: 'border-red-500',
  };

  const borderClass = revealed 
    ? (wasCorrect ? 'border-green-400 animate-pulse_green' : 'border-red-400 animate-pulse_red')
    : (difficultyColors[card.difficulty] || 'border-gray-600');

  return (
    <div className={`w-full max-w-md bg-gray-800 rounded-lg border-4 ${borderClass} shadow-2xl p-6 transition-all duration-300 transform ${revealed ? '' : 'hover:scale-105'}`}>
      <div className="flex justify-between items-start">
        <h3 className="text-2xl font-bold text-white capitalize">{card.product} - {card.brand}</h3>
        <span className={`px-3 py-1 text-sm font-bold rounded-full ${isLegit && revealed ? 'bg-green-500/20 text-green-300' : ''} ${!isLegit && revealed ? 'bg-red-500/20 text-red-300' : 'bg-gray-700'}`}>
          {revealed ? card.label.toUpperCase() : '???'}
        </span>
      </div>

      <div className="my-4">
        <p className="text-4xl font-mono font-bold text-yellow-400 flex items-center">
            <DollarSign size={32} className="mr-2"/> 
            {card.priceBRL.toFixed(2)}
            {card.originalPriceBRL && (
                <span className="text-lg text-gray-400 line-through ml-3">
                    {card.originalPriceBRL.toFixed(2)}
                </span>
            )}
        </p>
      </div>

      <div className="space-y-3 text-gray-300">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-blue-400 flex-shrink-0" />
          <p>{card.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Truck size={20} className="text-purple-400 flex-shrink-0" />
          <p>{card.shippingInfo}</p>
        </div>
        <div className="flex items-center gap-3">
          <ImageIcon size={20} className="text-orange-400 flex-shrink-0" />
          <p>{card.photos} foto{card.photos !== 1 ? 's' : ''} no anúncio</p>
        </div>
      </div>

      {card.signals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="font-bold text-sm text-gray-400 flex items-center gap-2 mb-2"><AlertTriangle size={16}/> Pistas:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
            {card.signals.map((signal, index) => (
              <li key={index}>{signal}</li>
            ))}
          </ul>
        </div>
      )}

      {revealed && (
        <div className={`mt-4 pt-4 border-t border-gray-700 flex items-center justify-center gap-2 font-bold ${wasCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {wasCorrect ? <CheckCircle /> : <XCircle />}
            <span>Sua resposta foi {wasCorrect ? 'correta' : 'incorreta'}! Pontos: {feedback.score_change > 0 ? '+' : ''}{feedback.score_change}</span>
        </div>
      )}
    </div>
  );
};

export default OfferCard;
