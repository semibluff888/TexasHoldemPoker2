# ♠ Texas Hold'em Poker ♥

A browser-based Texas Hold'em Poker game featuring an elegant SPY×FAMILY themed UI with smooth animations, intelligent AI opponents, and bilingual support (English/Chinese).

![Game Screenshot](pic/screenshot.png)

## 🎮 Features

- **Full Texas Hold'em Gameplay**: Complete implementation of Texas Hold'em rules including all betting rounds (Pre-flop, Flop, Turn, River)
- **4 AI Opponents**: Strategic AI players with SPY×FAMILY character portraits that randomize each game
- **Advanced AI Personalities**: Adjustable difficulty levels (Easy, Medium, Hard) to suit your skill level
- **Game Speed Control**: Toggle between Fast and Slow modes for your preferred pace
- **Cursor Effects**: Interactive cursor trails (Sparkle, Comet, Bubble) for added visual flair
- **Beautiful User Interface**: Modern design with:
  - Smooth card dealing animations with dealer GIF
  - Professional poker table layout with SPY×FAMILY theme
  - Real-time action history tracking with hand navigation
  - Interactive betting controls with slider
  - Glassmorphism effects and vibrant gradients
  - Winner celebration animations
- **Sound & Music**: Background music and sound effects for dealing, betting, folding, and winning
- **Bilingual Support**: Full English and Chinese language support with automatic browser detection
- **Cursor Effects**: Choose from Sparkle, Comet, or Bubble cursor trail effects
- **Complete Hand Evaluation**: Accurate poker hand ranking system supporting all hand types from High Card to Royal Flush
- **Responsive Controls**: Intuitive betting interface with Fold, Check, Call, Raise, and All-In options
- **Game State Management**: Proper dealer button rotation, blind posting, and turn-based gameplay

## 🎯 Game Rules

### Objective
Win chips by having the best five-card poker hand or by making other players fold.

### Gameplay Flow
1. **Blinds**: Small blind ($10) and big blind ($20) are posted automatically
2. **Pre-flop**: Each player receives 2 hole cards
3. **Flop**: 3 community cards are revealed
4. **Turn**: 4th community card is revealed
5. **River**: 5th and final community card is revealed
6. **Showdown**: Players reveal their hands, best hand wins the pot

### Betting Actions
- **Fold**: Give up your hand and forfeit the pot
- **Check**: Pass the action without betting (only available when no bet is required)
- **Call**: Match the current bet
- **Raise**: Increase the current bet
- **All-In**: Bet all remaining chips

## 🏆 Hand Rankings
From highest to lowest:
1. **Royal Flush**: A, K, Q, J, 10 of the same suit
2. **Straight Flush**: Five consecutive cards of the same suit
3. **Four of a Kind**: Four cards of the same rank
4. **Full House**: Three of a kind plus a pair
5. **Flush**: Five cards of the same suit
6. **Straight**: Five consecutive cards of any suit
7. **Three of a Kind**: Three cards of the same rank
8. **Two Pair**: Two different pairs
9. **One Pair**: Two cards of the same rank
10. **High Card**: Highest card in hand

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No server or build process required!
- **Note**: The game works best on desktop browsers.

### Installation
1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start playing!

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd TexasHoldemPoker

# Open index.html in your browser
# On Windows:
start index.html

# On Mac:
open index.html

# On Linux:
xdg-open index.html
```

## 📁 Project Structure

```
TexasHoldemPoker/
├── index.html          # Main HTML structure
├── styles.css          # All styling and animations
├── game.js             # Game logic, AI, and translations
├── pic/
│   ├── chip.png        # Poker chip image
│   ├── dealing*.gif    # Dealer animations
│   ├── user_win.gif    # Win celebration animation
│   ├── portrait/       # AI player character portraits
│   └── screenshot.png  # Game screenshot
├── audio/              # Sound effects and music
└── README.md           # This file
```

## 🎨 Technical Details

### Technologies Used
- **HTML5**: Semantic markup for game structure
- **CSS3**: Modern styling with animations, gradients, and glassmorphism effects
- **Vanilla JavaScript**: Pure JS implementation with no dependencies
- **Google Fonts**: Outfit font family for clean typography
- **Web Audio API**: Sound effects and background music

### Key Features in Code
- **Async/Await Pattern**: Smooth, sequential animations for card dealing
- **Hand Evaluation Algorithm**: Comprehensive poker hand ranking with tie-breaking
- **AI Decision Making**: Dynamic AI with hand strength evaluation and betting strategy
- **State Management**: Robust game state tracking across all betting phases
- **Internationalization**: Full translation system with bilingual support
- **Responsiveness**: Adapts layout for different screen sizes and orientations
- **Local Storage**: Persists your preferences (Game Mode, Language, Cursor Effect, Stats toggle)

## 🎲 How to Play

1. **Start a New Game**: Click the "NEW GAME" button to begin
2. **Your Turn**: When it's your turn, the betting controls will activate
3. **Make Your Move**: Choose to Fold, Check, Call, Raise, or go All-In
4. **Raise Control**: Use the slider to adjust your raise amount
5. **Watch AI Players**: AI opponents will make their decisions automatically
6. **View Results**: At showdown, the winner will be announced with their winning hand
7. **Continue Playing**: The next hand starts automatically after each round
8. **Language Toggle**: Click the language button (中文/EN) to switch languages
9. **Sound Controls**: Use the music and sound effect buttons in the header
10. **Game Configuration**:
    - **Difficulty**: Click on an AI player's portrait to toggle their difficulty (Easy/Medium/Hard)
    - **Speed**: Click the "FAST/SLOW" button to change game speed
    - **Cursor**: Select your preferred cursor effect from the dropdown
    - **Stats**: Toggle detailed player statistics display

## 🤖 AI Behavior

The AI opponents use a strategy-based decision-making system:
- **Hand Strength Evaluation**: Analyzes current hand and community cards
- **Betting Pattern**: Adjusts aggression based on hand quality
- **Bluffing**: Occasionally raises with medium-strength hands
- **Fold Logic**: Folds weak hands when facing raises
- **All-In Strategy**: Goes all-in with very strong hands
- **Difficulty Levels**:
    - **Easy**: Plays more passively, folds often to aggression
    - **Medium**: Balanced approach, makes reasonable bets, calculates odds, Opponent-based adjustments, occasionally bluffs
    - **Hard**: TBD, currently same as Medium

## 📊 Game Configuration

Default settings (can be modified in `game.js`):
- **Starting Chips**: $1000 per player
- **Small Blind**: $10
- **Big Blind**: $20
- **Number of Players**: 5 (1 human + 4 AI)

## 📝 License

This project is open source and available for personal and educational use.

## 🙏 Acknowledgments

- Card suits and poker hand rankings based on standard Texas Hold'em rules
- UI design inspired by modern poker applications
- Character portraits from SPY×FAMILY anime
- Built with passion for poker and clean code

---

**Enjoy the game! May the best hand win! 🎰**
