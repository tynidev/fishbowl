import React from 'react';
import { Link } from 'react-router-dom'; // Assuming you're using React Router for navigation

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Fishbowl Game</h1>
      <div>
        <Link to="/new-game">
          <button>New Game</button>
        </Link>
      </div>
      <div>
        <Link to="/join-game">
          <button>Join Game</button>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;
