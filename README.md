# YNG Token Trading Platform 💎

A pump.fun-style trading platform for YNG tokens built with vanilla HTML, CSS, and JavaScript. Features AMM (Automated Market Maker) pricing, real-time charts, and a complete DeFi trading experience.

![YNG Trading Platform](https://img.shields.io/badge/YNG-Trading%20Platform-00d2ff?style=for-the-badge)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-green?style=for-the-badge)
![No Dependencies](https://img.shields.io/badge/No-Backend-blue?style=for-the-badge)

## 🚀 Features

### Core Trading Features
- **AMM-based Trading**: Uses constant product formula (k = x * y) for price discovery
- **Real-time Price Charts**: Interactive charts with 1H, 4H, 1D, and 7D timeframes
- **Instant Execution**: Immediate trade execution with price impact calculations
- **Virtual Trading**: Start with €100 virtual balance, no real money involved

### User Experience
- **Username Authentication**: Simple username-based login system
- **Mobile Responsive**: Optimized for all device sizes
- **PWA Support**: Install as a native app with offline capabilities
- **Modern UI**: Crypto/DeFi-inspired design with smooth animations

### Platform Features
- **Leaderboard**: Track top token holders
- **Trade History**: View recent trades from all users
- **Market Statistics**: Real-time market cap, volume, and liquidity data
- **Quick Trading**: Preset amounts (€10, €25, €50, €100) for fast trading

## 🛠 Technical Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js for price visualization
- **Storage**: Browser localStorage (no backend required)
- **PWA**: Service Worker + Web App Manifest
- **Architecture**: Single Page Application (SPA)

## 📊 Trading Mechanics

### AMM Formula
```
k = EUR_reserves × YNG_tokens (constant)
price = EUR_reserves ÷ YNG_tokens
```

### Initial Liquidity Pool
- **YNG Tokens**: 10,000
- **EUR Reserves**: €1,000
- **Starting Price**: €0.1 per YNG
- **Constant (k)**: 10,000,000

### Price Impact Calculation
The platform calculates price impact for each trade using the constant product formula, showing users exactly how their trade will affect the token price.

## 🚀 Getting Started

1. **Clone or Download** the project files
2. **Open** `index.html` in a web browser
3. **Enter a username** to start trading
4. **Receive €100** starting balance automatically
5. **Start trading** YNG tokens immediately!

### Local Development
```bash
# Serve files locally (optional)
npx http-server .
# or
python -m http.server 8000
```

## 📱 PWA Installation

The platform can be installed as a Progressive Web App:

1. Open the trading platform in a supported browser
2. Look for the "Install" or "Add to Home Screen" prompt
3. Follow the installation steps
4. Launch as a native app from your device

## 🏗 File Structure

```
yng-coin/
├── index.html          # Main HTML file
├── styles.css          # All CSS styles
├── app.js             # Core JavaScript logic
├── manifest.json      # PWA manifest
├── sw.js             # Service Worker for PWA
├── README.md         # This file
└── .github/
    └── copilot-instructions.md
```

## 🎮 How to Trade

### Buying YNG Tokens
1. Select the "Buy" tab in the trading panel
2. Enter the EUR amount or click quick amount buttons
3. Review the estimated YNG tokens you'll receive
4. Check the price impact percentage
5. Click "Buy YNG" to execute the trade

### Selling YNG Tokens
1. Select the "Sell" tab in the trading panel
2. Enter the YNG token amount (or click "MAX")
3. Review the EUR amount you'll receive
4. Check the price impact percentage
5. Click "Sell YNG" to execute the trade

## 📈 Market Data

The platform tracks and displays:
- **Current Price**: Real-time YNG/EUR price
- **24h Price Change**: Percentage change over 24 hours
- **Market Cap**: Total value of all YNG tokens
- **24h Volume**: Total EUR traded in the last 24 hours
- **Liquidity Pool**: Current EUR reserves available for trading

## 🏆 Leaderboard

The leaderboard displays:
- Top 10 YNG token holders
- Real-time rankings based on token holdings
- Special badges for top 3 positions (Gold, Silver, Bronze)

## 💾 Data Persistence

All data is stored locally in your browser using localStorage:
- **User accounts** and balances
- **Trade history** (last 50 trades)
- **Price history** (7 days of data)
- **Liquidity pool** state

## 🔧 Customization

### Modifying Initial Parameters
Edit the `liquidityPool` object in `app.js`:
```javascript
this.liquidityPool = {
    yngTokens: 10000,     // Initial YNG token supply
    eurReserves: 1000,    // Initial EUR reserves
    k: 10000 * 1000      // Constant product
};
```

### Styling Changes
Modify `styles.css` to customize:
- Color scheme (CSS custom properties)
- Layout and spacing
- Animation effects
- Mobile responsiveness

## 🌐 Browser Compatibility

- **Chrome/Edge**: Full support including PWA features
- **Firefox**: Full support (PWA with limitations)
- **Safari**: Full support (PWA on iOS 11.3+)
- **Mobile Browsers**: Optimized for all major mobile browsers

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to contribute by:
1. Reporting bugs or issues
2. Suggesting new features
3. Submitting pull requests
4. Improving documentation

## ⚠️ Disclaimer

This is a simulation platform for educational and entertainment purposes only. No real money or cryptocurrencies are involved. All trading is virtual using simulated balances.

---

**Start your YNG trading journey today!** 🚀

*Built with ❤️ for the crypto community*
