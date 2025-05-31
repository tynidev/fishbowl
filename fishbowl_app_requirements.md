# Fishbowl PWA Requirements

## Overview

- The frontend of the app is a **React-based Progressive Web App (PWA)**.
- The backend should be implemented using **Express.js (Node.js)**.

## Project Structure
- `/frontend` - React PWA application
- `/backend` - Express.js server with Socket.IO
- `/database` - SQLite database schema and migrations

## Technical Stack
- Frontend: React 18+, TypeScript, PWA features (service worker, manifest)
- Backend: Express.js, Socket.IO, TypeScript
- Database: SQLite
- State Management: Redux Toolkit
- UI Framework: Material-UI, Chakra UI, or Tailwind CSS

## API Endpoints
- POST /api/games - Create new game
- GET /api/games/:code - Join game by code
- POST /api/games/:gameid/players - Add player
- POST /api/games/:gameid/:playerid:phrases - Submit phrases
- GET /api/games/:gameid/state - Get current game state
- etc.

## Real-time Events
- `game:created` - New game created
- `player:joined` - Player joined game
- `turn:started` - Turn started by controlling device
- `phrase:guessed` - Phrase marked as guessed
- `round:ended` - Round completed
- etc.

## Backend Responsibilities

- Serve static files from the React PWA build.
- Provide REST API endpoints for:
  - Game creation and setup
  - Player and team management
  - Game state updates (e.g., score tracking, turn progression)
- Handle **real-time updates** using **Socket.IO**:
  - Synchronize game state across all connected devices
  - Allow any device to trigger game actions (e.g., start round, skip phrase, submit guess)

## Database

- Use **SQLite** to store all persistent game data, including:
  - Players and teams
  - Phrases
  - Game sessions and metadata
  - Turn history and scores
- SQLite is chosen for its **simplicity and minimal setup**:
  - It runs as a local file-based database
  - No external database server is required

## Deployment

- The **Express backend and SQLite database will run on the same server as the React PWA frontend**.
- This setup simplifies deployment and allows the app to be self-contained on a single host.
- The backend must support:
  - Real-time synchronization across devices
  - Graceful reconnection and state recovery
  - Low-latency communication between clients

## Multi-Device & Multi-User Support
- The game supports **multiple devices connected simultaneously**, with real-time synchronization of game state across all devices.
- Each device can support **one or more users**. For example:
  - A single device can have multiple players logged in (e.g., 4 players on one tablet).
  - Multiple devices can connect for the same game session (e.g., 5 devices, each with 1 or more players).
- The app supports flexible team/player configurations, such as:
  - 3 teams with 4 players each (12 players total).
  - Any combination of players spread across any number of devices (1 device to 12 devices).
- Actions that control game flow—such as **starting a round, beginning a player's turn**-can be initiated from **any connected device**.
- Actions that control turn flow such as **marking guesses, or skipping phrases**-can only be initiated by device that started the round
- The controlling device for the current round will be the ONLY device to show what phrase/word is currently being guessed
- All connected devices will **update in real-time** to reflect the current game state, including:
  - Current round and turn information
  - Active player and team
  - Timer countdown
  - Guessed and remaining phrases
  - Scores and progress
- The app should handle connection and disconnection gracefully, ensuring that devices joining mid-game sync to the current state.

## Device Connection & Session Management
- Each device gets a unique device_id on first connection
- If device disconnects, maintain all game state
- On reconnection, restore device to current correct game state
- Show connection status indicator on UI

# Fishbowl Mobile App Requirements & UI Design

## 📋 Functional Requirements

### 1. Game Setup
- Create a game and share/join via link or code or qr code
- Game creator sets 
    - Number of teams (default 2, min 2, max 5)
    - Number of words/phrases per player (default to 3, min 1, max 10)
    - Time for each turn (default 1 min, min 10 seconds, max 5 mins) 
- Add player names
- Each player submits the configured amount of words/phrases

### 2. Game Rounds (reference Fishbowl Game Rules section for rules of the game)
- The game consists of 3 rounds, each with slightly different rules.
- Round 1 begins with a randomly selected player from a randomly selected team.
- Turns then rotate in a "snake draft" fashion:
    Example with 3 teams (A, B, C) with 2 players each:
    - Round starts: A1 → B1 → C1 → C2 → B2 → A2 → A1 → B1...
    - This order continues until all phrases are guessed
    - Same order preserved across all 3 rounds
- After the current player's turn ends, the next player from the next team takes their turn.
- Teams alternate turns, with players taking turns in order within their team.
- Once all players from all teams have taken a turn, the rotation continues from the next player in the original starting order.
- This cycle repeats until all phrases in the bowl have been guessed for the current round.
- The same player order is preserved across Rounds 2 and 3.

### 2.1 List of rounds
- Round 1: Taboo-style
- Round 2: Charades (no words)
- Round 3: Password (one word)

### 2.2 Each Round
- Track and display which team and which player is up
- Track and display team score per round and cumulative
- Show list of guessed and remaining phrases per round
- A round continues until all words/phrases in the bowl have been guessed.

### 3. In-Game Turn Flow
- When a player starts their turn, their device becomes the "controlling device"
- Only the controlling device can see the current phrase
- Only the controlling device can mark phrases as guessed or skip
- All other devices see a waiting screen with timer and score updates
- When turn ends, control is released
- "Start Turn" button begins timer (configured in game setup) and shows prompt
- Buttons for "Guessed Correctly" and "Skip"
- On timeout pass to next team/player
- If all phrases/words run out the round ends
- On round end, show game summary and button to start the next round

### 4. Post-Game
- Display final scores and winning team
- Option to replay with same players, or to balance teams based on which players got the most points
- Share results (optional)

## 📱 UI Screens & Flow

### Home Screen
- Options: 
    - "New Game"
    - "Join Game"
    - "How to Play"

### Lobby Screen
- Add players and team assignment
- Player list and edit/delete options
- “Start Game” button
- Game creator can change the game options (timer, number of words, number of teams)

### Word Submission Screen
- One player per screen, or all simultaneously (depends on mode)
- Allow typing words/phrases one at a time, confirm before adding
- Progress bar (e.g., “3 of 5 words submitted”)

### Game Round Screen
- Clear display of timer
- Phrase/word large and centered
- Buttons: ✅ Guessed | ❌ Skip | ⏹ End Turn
- Team and player name shown
- Background color changes per team
- Points in round for team and player shown

### Between Rounds
- Recap: total points per team
- Show which round is next and a brief rule reminder
- "Start Next Round" button

### End Game Screen
- Animated winner announcement
- Score breakdown
- Options: "Play Again", "New Game", "Share Results"

### Error Handling
- Network disconnection recovery
- Invalid game codes
- Browser refresh handling

## 🎯 Stretch Features
- Word filtering (e.g., family-friendly mode)
- Sound effects / buzzer

# 🎉 Fishbowl Game Rules

Fishbowl is a fun party game that combines elements of **Charades**, **Taboo**, and **Password**. It's great for medium to large groups and is played in three rounds using the same set of clues.

---

## 🎲 What You Need:
- Small slips of paper or index cards
- Pens
- A bowl (the "fishbowl")
- Timer (e.g., phone or stopwatch)

---

## 👥 Setup:
1. **Split into two teams**.
2. Each player writes **3–5 words or phrases** on slips of paper (inside jokes, celebrities, movie titles, random objects — anything!)
3. All slips go into the bowl and get shuffled.

---

## 🧠 Objective:
Get your team to guess as many words as possible per turn. The team with the most total points after all three rounds wins.

---

## 🕹️ The Three Rounds:

### Round 1: Taboo
- You can say **anything** *except* the word or a variation of it.
- Use descriptions, stories, rhymes, etc.
- No acting.
- 1-minute timer per turn.
- Skip if stuck.

**Example:** For “Toothbrush,” you might say: “You use it every morning and night on your teeth.”

### Round 2: Charades
- **No talking** at all.
- Act out the word/phrase.
- 1-minute timer per turn.
- You’re using the same words from Round 1.

### Round 3: Password
- Say **only one word** to describe the word/phrase.
- Your team gets one guess.
- 1-minute timer per turn.

**Example:** For “Toothbrush,” you might just say: “Bristles.”

---

## 🔁 How It Flows:
- Teams take turns sending up one person at a time as the clue-giver.
- Continue until all slips are guessed in a round.
- After each round, return all slips to the bowl and reshuffle.
- Keep score of how many each team gets per round.

---

## 🔚 End of Game:
Add up all three rounds’ points per team. Highest total wins!