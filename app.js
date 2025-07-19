// YNG Token Trading Platform
class TradingPlatform {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
        this.trades = this.loadTrades();
        this.priceHistory = this.loadPriceHistory();
        this.chart = null;
        this.chartTimeframe = '1h';
        
        // Initial liquidity pool (constant product AMM)
        this.liquidityPool = this.loadLiquidityPool() || {
            yngTokens: 10000,
            eurReserves: 1000,
            k: 10000 * 1000 // constant product
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkLogin();
        this.initChart();
        
        // Update UI every second
        setInterval(() => {
            if (this.currentUser) {
                this.updateUI();
            }
        }, 1000);
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Trading tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Quick amount buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('buyAmount').value = e.target.dataset.amount;
                this.updateBuyEstimate();
            });
        });

        // MAX button for selling
        document.querySelector('.max-btn').addEventListener('click', () => {
            const maxTokens = this.currentUser.yngTokens;
            document.getElementById('sellAmount').value = maxTokens;
            this.updateSellEstimate();
        });

        // Buy/Sell buttons
        document.getElementById('buyBtn').addEventListener('click', () => {
            this.executeBuy();
        });

        document.getElementById('sellBtn').addEventListener('click', () => {
            this.executeSell();
        });

        // Amount input listeners for real-time estimates
        document.getElementById('buyAmount').addEventListener('input', () => {
            this.updateBuyEstimate();
        });

        document.getElementById('sellAmount').addEventListener('input', () => {
            this.updateSellEstimate();
        });

        // Timeframe controls
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeTimeframe(e.target.dataset.timeframe);
            });
        });
    }

    // Authentication
    login() {
        const username = document.getElementById('usernameInput').value.trim();
        if (!username) return;

        if (!this.users[username]) {
            // New user
            this.users[username] = {
                username: username,
                eurBalance: 100,
                yngTokens: 0,
                joinDate: Date.now(),
                totalTraded: 0
            };
            this.showToast(`Welcome ${username}! You received €100 starting balance.`, 'success');
        } else {
            this.showToast(`Welcome back ${username}!`, 'success');
        }

        this.currentUser = this.users[username];
        this.saveUsers();
        this.showMainApp();
        this.updateUI();
    }

    logout() {
        this.currentUser = null;
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('usernameInput').value = '';
    }

    checkLogin() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser && this.users[savedUser]) {
            this.currentUser = this.users[savedUser];
            this.showMainApp();
            this.updateUI();
        }
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        localStorage.setItem('currentUser', this.currentUser.username);
    }

    // AMM Trading Logic
    getCurrentPrice() {
        return this.liquidityPool.eurReserves / this.liquidityPool.yngTokens;
    }

    calculateBuyAmount(eurAmount) {
        // Using constant product formula: (x + dx) * (y - dy) = k
        // Where x = EUR reserves, y = YNG tokens, k = constant product
        const { yngTokens, eurReserves, k } = this.liquidityPool;
        const newEurReserves = eurReserves + eurAmount;
        const newYngTokens = k / newEurReserves;
        const tokensReceived = yngTokens - newYngTokens;
        
        return {
            tokensReceived: Math.max(0, tokensReceived),
            newPrice: newEurReserves / newYngTokens,
            priceImpact: ((newEurReserves / newYngTokens) / (eurReserves / yngTokens) - 1) * 100
        };
    }

    calculateSellAmount(tokenAmount) {
        // Using constant product formula: (x - dx) * (y + dy) = k
        const { yngTokens, eurReserves, k } = this.liquidityPool;
        const newYngTokens = yngTokens + tokenAmount;
        const newEurReserves = k / newYngTokens;
        const eurReceived = eurReserves - newEurReserves;
        
        return {
            eurReceived: Math.max(0, eurReceived),
            newPrice: newEurReserves / newYngTokens,
            priceImpact: ((newEurReserves / newYngTokens) / (eurReserves / yngTokens) - 1) * 100
        };
    }

    executeBuy() {
        const eurAmount = parseFloat(document.getElementById('buyAmount').value);
        if (!eurAmount || eurAmount <= 0 || eurAmount > this.currentUser.eurBalance) {
            this.showToast('Invalid amount or insufficient balance!', 'error');
            return;
        }

        const calculation = this.calculateBuyAmount(eurAmount);
        
        // Update user balance
        this.currentUser.eurBalance -= eurAmount;
        this.currentUser.yngTokens += calculation.tokensReceived;
        this.currentUser.totalTraded += eurAmount;

        // Update liquidity pool
        this.liquidityPool.eurReserves += eurAmount;
        this.liquidityPool.yngTokens -= calculation.tokensReceived;

        // Record trade
        this.recordTrade('buy', this.currentUser.username, eurAmount, calculation.tokensReceived, calculation.newPrice);
        
        // Update price history
        this.addPricePoint(calculation.newPrice);
        
        this.saveData();
        this.updateUI();
        this.updateChart();
        
        this.showToast(`Bought ${calculation.tokensReceived.toFixed(4)} YNG for €${eurAmount}`, 'success');
        document.getElementById('buyAmount').value = '';
        this.updateBuyEstimate();
    }

    executeSell() {
        const tokenAmount = parseFloat(document.getElementById('sellAmount').value);
        if (!tokenAmount || tokenAmount <= 0 || tokenAmount > this.currentUser.yngTokens) {
            this.showToast('Invalid amount or insufficient tokens!', 'error');
            return;
        }

        const calculation = this.calculateSellAmount(tokenAmount);
        
        // Update user balance
        this.currentUser.yngTokens -= tokenAmount;
        this.currentUser.eurBalance += calculation.eurReceived;
        this.currentUser.totalTraded += calculation.eurReceived;

        // Update liquidity pool
        this.liquidityPool.yngTokens += tokenAmount;
        this.liquidityPool.eurReserves -= calculation.eurReceived;

        // Record trade
        this.recordTrade('sell', this.currentUser.username, calculation.eurReceived, tokenAmount, calculation.newPrice);
        
        // Update price history
        this.addPricePoint(calculation.newPrice);
        
        this.saveData();
        this.updateUI();
        this.updateChart();
        
        this.showToast(`Sold ${tokenAmount.toFixed(4)} YNG for €${calculation.eurReceived.toFixed(2)}`, 'success');
        document.getElementById('sellAmount').value = '';
        this.updateSellEstimate();
    }

    recordTrade(type, username, eurAmount, tokenAmount, price) {
        const trade = {
            type,
            username,
            eurAmount,
            tokenAmount,
            price,
            timestamp: Date.now()
        };
        
        this.trades.unshift(trade);
        
        // Keep only last 50 trades
        if (this.trades.length > 50) {
            this.trades = this.trades.slice(0, 50);
        }
    }

    addPricePoint(price) {
        const now = Date.now();
        this.priceHistory.push({
            timestamp: now,
            price: price
        });
        
        // Keep only last 7 days of data
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        this.priceHistory = this.priceHistory.filter(point => point.timestamp >= sevenDaysAgo);
    }

    // UI Updates
    updateUI() {
        if (!this.currentUser) return;

        const currentPrice = this.getCurrentPrice();
        const marketCap = currentPrice * 10000; // total supply
        
        // Update navigation
        document.getElementById('currentUser').textContent = this.currentUser.username;
        document.getElementById('userBalance').textContent = `€${this.currentUser.eurBalance.toFixed(2)}`;
        document.getElementById('userTokens').textContent = `${this.currentUser.yngTokens.toFixed(4)} YNG`;
        document.getElementById('currentPrice').textContent = `€${currentPrice.toFixed(6)}`;
        
        // Update price change
        const priceChange = this.calculatePriceChange();
        const priceChangeEl = document.getElementById('priceChange');
        priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
        priceChangeEl.className = `price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
        
        // Update market info
        document.getElementById('marketCap').textContent = `€${marketCap.toFixed(0)}`;
        document.getElementById('liquidityPool').textContent = `€${this.liquidityPool.eurReserves.toFixed(0)}`;
        document.getElementById('volume24h').textContent = `€${this.calculate24hVolume().toFixed(0)}`;
        
        // Update trading panel
        document.getElementById('sellBalance').textContent = `${this.currentUser.yngTokens.toFixed(4)} YNG`;
        
        this.updateBuyEstimate();
        this.updateSellEstimate();
        this.updateRecentTrades();
        this.updateLeaderboard();
    }

    updateBuyEstimate() {
        const eurAmount = parseFloat(document.getElementById('buyAmount').value) || 0;
        if (eurAmount > 0) {
            const calculation = this.calculateBuyAmount(eurAmount);
            document.getElementById('buyEstimate').textContent = `${calculation.tokensReceived.toFixed(4)} YNG`;
            document.getElementById('buyPriceImpact').textContent = `${calculation.priceImpact.toFixed(2)}%`;
        } else {
            document.getElementById('buyEstimate').textContent = '0 YNG';
            document.getElementById('buyPriceImpact').textContent = '0.00%';
        }
    }

    updateSellEstimate() {
        const tokenAmount = parseFloat(document.getElementById('sellAmount').value) || 0;
        if (tokenAmount > 0) {
            const calculation = this.calculateSellAmount(tokenAmount);
            document.getElementById('sellEstimate').textContent = `€${calculation.eurReceived.toFixed(2)}`;
            document.getElementById('sellPriceImpact').textContent = `${calculation.priceImpact.toFixed(2)}%`;
        } else {
            document.getElementById('sellEstimate').textContent = '€0.00';
            document.getElementById('sellPriceImpact').textContent = '0.00%';
        }
    }

    updateRecentTrades() {
        const container = document.getElementById('tradesContainer');
        const recentTrades = this.trades.slice(0, 10);
        
        if (recentTrades.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No trades yet</div>';
            return;
        }
        
        container.innerHTML = recentTrades.map(trade => `
            <div class="trade-item">
                <div class="trade-info">
                    <div class="trade-user">${trade.username}</div>
                    <div class="trade-details">${this.formatTime(trade.timestamp)}</div>
                </div>
                <div class="trade-amount ${trade.type}">
                    ${trade.type === 'buy' ? '+' : '-'}${trade.tokenAmount.toFixed(4)} YNG
                </div>
            </div>
        `).join('');
    }

    updateLeaderboard() {
        const container = document.getElementById('leaderboardContainer');
        const sortedUsers = Object.values(this.users)
            .sort((a, b) => b.yngTokens - a.yngTokens)
            .slice(0, 10);
        
        if (sortedUsers.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No holders yet</div>';
            return;
        }
        
        container.innerHTML = sortedUsers.map((user, index) => {
            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';
            
            return `
                <div class="leader-item">
                    <div class="leader-rank ${rankClass}">${index + 1}</div>
                    <div class="leader-name">${user.username}</div>
                    <div class="leader-tokens">${user.yngTokens.toFixed(4)} YNG</div>
                </div>
            `;
        }).join('');
    }

    // Chart Management
    initChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'YNG Price (EUR)',
                    data: [],
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                hour: 'HH:mm',
                                day: 'MMM dd'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                return '€' + value.toFixed(6);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        this.updateChart();
    }

    updateChart() {
        if (!this.chart) return;
        
        const data = this.getChartData(this.chartTimeframe);
        this.chart.data.datasets[0].data = data;
        this.chart.update('none');
    }

    getChartData(timeframe) {
        const now = Date.now();
        let startTime;
        
        switch (timeframe) {
            case '1h':
                startTime = now - (60 * 60 * 1000);
                break;
            case '4h':
                startTime = now - (4 * 60 * 60 * 1000);
                break;
            case '1d':
                startTime = now - (24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = now - (7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = now - (60 * 60 * 1000);
        }
        
        let filteredData = this.priceHistory.filter(point => point.timestamp >= startTime);
        
        // If no data in timeframe, add current price
        if (filteredData.length === 0) {
            filteredData = [{
                timestamp: now,
                price: this.getCurrentPrice()
            }];
        }
        
        return filteredData.map(point => ({
            x: point.timestamp,
            y: point.price
        }));
    }

    changeTimeframe(timeframe) {
        this.chartTimeframe = timeframe;
        
        // Update active button
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-timeframe="${timeframe}"]`).classList.add('active');
        
        this.updateChart();
    }

    // UI Helpers
    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tab}Tab`).classList.add('active');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    // Utility Functions
    calculatePriceChange() {
        if (this.priceHistory.length < 2) return 0;
        
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const oldPrice = this.priceHistory.find(point => point.timestamp <= oneDayAgo);
        const currentPrice = this.getCurrentPrice();
        
        if (!oldPrice) return 0;
        
        return ((currentPrice - oldPrice.price) / oldPrice.price) * 100;
    }

    calculate24hVolume() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return this.trades
            .filter(trade => trade.timestamp >= oneDayAgo)
            .reduce((total, trade) => total + trade.eurAmount, 0);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    // Data Persistence
    saveData() {
        this.saveUsers();
        this.saveTrades();
        this.savePriceHistory();
        this.saveLiquidityPool();
    }

    saveUsers() {
        localStorage.setItem('yngTradingUsers', JSON.stringify(this.users));
    }

    saveTrades() {
        localStorage.setItem('yngTradingTrades', JSON.stringify(this.trades));
    }

    savePriceHistory() {
        localStorage.setItem('yngTradingPriceHistory', JSON.stringify(this.priceHistory));
    }

    saveLiquidityPool() {
        localStorage.setItem('yngTradingLiquidityPool', JSON.stringify(this.liquidityPool));
    }

    loadUsers() {
        const data = localStorage.getItem('yngTradingUsers');
        return data ? JSON.parse(data) : {};
    }

    loadTrades() {
        const data = localStorage.getItem('yngTradingTrades');
        return data ? JSON.parse(data) : [];
    }

    loadPriceHistory() {
        const data = localStorage.getItem('yngTradingPriceHistory');
        const history = data ? JSON.parse(data) : [];
        
        // Add initial price point if no history
        if (history.length === 0) {
            history.push({
                timestamp: Date.now(),
                price: 0.1 // Initial price of €0.1
            });
        }
        
        return history;
    }

    loadLiquidityPool() {
        const data = localStorage.getItem('yngTradingLiquidityPool');
        return data ? JSON.parse(data) : null;
    }
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Initialize the trading platform
const tradingPlatform = new TradingPlatform();
