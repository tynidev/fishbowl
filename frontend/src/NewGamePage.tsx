import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NewGamePage: React.FC = () => {
  const [numTeams, setNumTeams] = useState<number>(2);
  const [phrasesPerPlayer, setPhrasesPerPlayer] = useState<number>(3);
  const [turnTimerSec, setTurnTimerSec] = useState<number>(60);
  const navigate = useNavigate();

  const handleCreateGame = () => {
    // TODO: Implement API call to create game
    console.log('Creating game with settings:', {
      numTeams,
      phrasesPerPlayer,
      turnTimerSec,
    });
    // Navigate to lobby or game page after creation
    // navigate('/lobby/GAME_ID');
  };

  return (
    <div>
      <h1>Create New Game</h1>
      <div>
        <label htmlFor="numTeams">Number of Teams:</label>
        <input
          type="number"
          id="numTeams"
          value={numTeams}
          onChange={e => setNumTeams(parseInt(e.target.value, 10))}
          min="2"
        />
      </div>
      <div>
        <label htmlFor="phrasesPerPlayer">Phrases Per Player:</label>
        <input
          type="number"
          id="phrasesPerPlayer"
          value={phrasesPerPlayer}
          onChange={e => setPhrasesPerPlayer(parseInt(e.target.value, 10))}
          min="1"
        />
      </div>
      <div>
        <label htmlFor="turnTimerSec">Turn Timer (seconds):</label>
        <input
          type="number"
          id="turnTimerSec"
          value={turnTimerSec}
          onChange={e => setTurnTimerSec(parseInt(e.target.value, 10))}
          min="10"
        />
      </div>
      <button onClick={handleCreateGame}>Create Game</button>
      <button onClick={() => navigate('/')}>Back to Home</button>
    </div>
  );
};

export default NewGamePage;
