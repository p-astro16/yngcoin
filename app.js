// YNG Token Trading Platform
class TradingPlatform {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
        this.trades = this.loadTrades();
        this.priceHistory = this.loadPriceHistory();
        this.chart = null;
        this.chartTimeframe = '1h';
        this.aiTraders = this.loadAITraders();
        this.aiTradingInterval = null;
        
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
        this.initAITraders();
        this.startAITrading();
        
        // Update UI every 0.3 seconds (was 1 second)
        setInterval(() => {
            if (this.currentUser) {
                this.updateUI();
            }
        }, 300);
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

        // SHA256 code input for adding euros
        document.getElementById('codeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processCode();
            }
        });

        document.getElementById('redeemBtn').addEventListener('click', () => {
            this.processCode();
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
        
        // Keep only last 200 trades (was 50, nu 200 voor meer historie bij snelle trades)
        if (this.trades.length > 200) {
            this.trades = this.trades.slice(0, 200);
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

    // AI Traders System
    initAITraders() {
        if (this.aiTraders.length === 0) {
            console.log('Initializing 1000 AI traders...');
            const traderNames = this.generateTraderNames();
            
            for (let i = 0; i < 1000; i++) {
                const trader = {
                    username: traderNames[i],
                    eurBalance: Math.random() * 50 + 25, // Random balance between 25-75 EUR
                    yngTokens: 1000, // Everyone starts with 1000 YNG
                    isAI: true,
                    personality: this.generateTraderPersonality(),
                    lastTrade: Date.now() - Math.random() * 3600000, // Random last trade up to 1 hour ago
                    totalTraded: 0
                };
                this.aiTraders.push(trader);
                this.users[trader.username] = trader;
            }
            this.saveAITraders();
            this.saveUsers();
            console.log('AI traders initialized!');
        }
    }

    generateTraderNames() {
        const prefixes = ['Crypto', 'Moon', 'Diamond', 'Rocket', 'Whale', 'Bull', 'Bear', 'Degen', 'Chad', 'Ape',
            'Sigma', 'Alpha', 'Beta', 'Gamma', 'Laser', 'Turbo', 'Ultra', 'Mega', 'Giga', 'Meta'];
        const suffixes = ['Trader', 'Hunter', 'Master', 'King', 'Lord', 'God', 'Beast', 'Machine', 'Pro', 'X',
            '2000', '420', '69', 'AI', 'Bot', 'Dude', 'Guy', 'Bro', 'Fam', 'Ninja'];
        const numbers = ['', '1', '2', '3', '7', '88', '100', '420', '777', '999'];
        
        const names = [];
        for (let i = 0; i < 1000; i++) {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            const number = numbers[Math.floor(Math.random() * numbers.length)];
            names.push(`${prefix}${suffix}${number}`);
        }
        return names;
    }

    generateTraderPersonality() {
        return {
            aggression: Math.random(), // 0 = conservative, 1 = aggressive
            greed: Math.random(), // How much profit they want
            fear: Math.random(), // How quickly they panic sell
            patience: Math.random(), // How long they wait between trades
            trendFollowing: Math.random(), // How much they follow trends
            contrarian: Math.random() // How likely to go against the trend
        };
    }

    startAITrading() {
        // AI traders make trades every 0.5-3 seconds (veel sneller!)
        this.aiTradingInterval = setInterval(() => {
            this.executeAITrades();
        }, Math.random() * 2500 + 500);
    }

    executeAITrades() {
        const currentPrice = this.getCurrentPrice();
        const priceChange = this.calculatePriceChange();
        
        // Select random AI traders who might trade (veel meer traders actief)
        const activeTraders = this.aiTraders.filter(trader => {
            const timeSinceLastTrade = Date.now() - trader.lastTrade;
            const shouldTrade = Math.random() < (trader.personality.aggression * 0.4); // 4x meer kans
            return shouldTrade && timeSinceLastTrade > 2000; // Alleen 2 seconden wachten
        });

        // Execute trades for selected traders (veel meer trades per keer)
        const numTradesToExecute = Math.min(Math.floor(Math.random() * 15) + 3, activeTraders.length); // 3-18 trades per keer
        
        for (let i = 0; i < numTradesToExecute; i++) {
            const trader = activeTraders[Math.floor(Math.random() * activeTraders.length)];
            this.executeAITrade(trader, currentPrice, priceChange);
        }
    }

    executeAITrade(trader, currentPrice, priceChange) {
        const decision = this.makeAITradingDecision(trader, currentPrice, priceChange);
        
        if (decision.action === 'buy' && decision.amount > 0 && trader.eurBalance >= decision.amount) {
            const calculation = this.calculateBuyAmount(decision.amount);
            
            // Update trader balance
            trader.eurBalance -= decision.amount;
            trader.yngTokens += calculation.tokensReceived;
            trader.totalTraded += decision.amount;
            trader.lastTrade = Date.now();

            // Update liquidity pool
            this.liquidityPool.eurReserves += decision.amount;
            this.liquidityPool.yngTokens -= calculation.tokensReceived;

            // Record trade
            this.recordTrade('buy', trader.username, decision.amount, calculation.tokensReceived, calculation.newPrice);
            this.addPricePoint(calculation.newPrice);
            
        } else if (decision.action === 'sell' && decision.amount > 0 && trader.yngTokens >= decision.amount) {
            const calculation = this.calculateSellAmount(decision.amount);
            
            // Update trader balance
            trader.yngTokens -= decision.amount;
            trader.eurBalance += calculation.eurReceived;
            trader.totalTraded += calculation.eurReceived;
            trader.lastTrade = Date.now();

            // Update liquidity pool
            this.liquidityPool.yngTokens += decision.amount;
            this.liquidityPool.eurReserves -= calculation.eurReceived;

            // Record trade
            this.recordTrade('sell', trader.username, calculation.eurReceived, decision.amount, calculation.newPrice);
            this.addPricePoint(calculation.newPrice);
        }
        
        this.saveData();
        this.saveAITraders();
    }

    makeAITradingDecision(trader, currentPrice, priceChange) {
        const personality = trader.personality;
        
        // Calculate trading signals
        let buySignal = 0;
        let sellSignal = 0;
        
        // Trend following
        if (priceChange > 0) {
            buySignal += personality.trendFollowing * 0.5;
        } else {
            sellSignal += personality.trendFollowing * 0.5;
        }
        
        // Contrarian behavior
        if (priceChange > 5) { // If price pumped hard
            sellSignal += personality.contrarian * 0.7;
        } else if (priceChange < -5) { // If price dumped hard
            buySignal += personality.contrarian * 0.7;
        }
        
        // Greed factor
        if (trader.yngTokens > 1000) { // If they have gains
            sellSignal += personality.greed * 0.3;
        }
        
        // Fear factor
        if (priceChange < -2) {
            sellSignal += personality.fear * 0.6;
        }
        
        // Random factor (meer volatiliteit)
        buySignal += (Math.random() - 0.5) * 0.8; // 2x meer random
        sellSignal += (Math.random() - 0.5) * 0.8;
        
        // Make decision (lagere threshold = meer trades)
        const threshold = 0.15; // Was 0.3, nu 0.15 voor veel meer trades
        
        if (buySignal > threshold && buySignal > sellSignal) {
            // Buy decision (grotere trade amounts)
            const maxAmount = Math.min(trader.eurBalance * 0.8, trader.eurBalance); // Was 0.5, nu 0.8
            const amount = Math.random() * maxAmount * (personality.aggression * 1.5); // 1.5x meer agressie
            return {
                action: 'buy',
                amount: Math.max(1, Math.min(amount, maxAmount))
            };
        } else if (sellSignal > threshold && sellSignal > buySignal) {
            // Sell decision (grotere trade amounts)
            const maxAmount = Math.min(trader.yngTokens * 0.6, trader.yngTokens - 50); // Was 0.3 en 100, nu 0.6 en 50
            const amount = Math.random() * maxAmount * (personality.aggression * 1.5);
            return {
                action: 'sell',
                amount: Math.max(1, Math.min(amount, maxAmount))
            };
        }
        
        return { action: 'hold', amount: 0 };
    }

    // SHA256 Code System
    processCode() {
        const code = document.getElementById('codeInput').value.trim();
        if (!code) {
            this.showToast('Please enter a code!', 'error');
            return;
        }

        try {
            const result = this.validateAndDecodeCode(code);
            if (result.valid) {
                this.currentUser.eurBalance += result.amount;
                this.saveUsers();
                this.showToast(`Added €${result.amount} to your wallet!`, 'success');
                document.getElementById('codeInput').value = '';
                this.updateUI();
            } else {
                this.showToast('Invalid code format!', 'error');
            }
        } catch (error) {
            this.showToast('Invalid code!', 'error');
        }
    }

    async validateAndDecodeCode(code) {
        try {
            // Decode the original data from SHA256
            const testData = this.generateTestCodes();
            
            for (const testCode of testData) {
                const hash = await this.sha256(testCode.original);
                if (hash === code.toLowerCase()) {
                    return {
                        valid: true,
                        amount: testCode.amount
                    };
                }
            }
            
            return { valid: false };
        } catch (error) {
            return { valid: false };
        }
    }

    generateTestCodes() {
        // Generate some valid codes for testing
        const now = new Date();
        const dateString = now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0];
        
        return [
            {
                original: `a1b2c3d4e5f6;YNG;EU;916;${dateString};9x8y7z6w5v4u`,
                amount: 916
            },
            {
                original: `f1e2d3c4b5a6;YNG;EU;500;${dateString};u4v5w6x7y8z9`,
                amount: 500
            },
            {
                original: `9z8y7x6w5v4u;YNG;EU;250;${dateString};a1b2c3d4e5f6`,
                amount: 250
            },
            {
                original: `m1n2o3p4q5r6;YNG;EU;100;${dateString};s7t8u9v0w1x2`,
                amount: 100
            },
            {
                original: `x2w1v0u9t8s7;YNG;EU;1000;${dateString};r6q5p4o3n2m1`,
                amount: 1000
            }
        ];
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        
        // Update chart price display
        document.getElementById('chartCurrentPrice').textContent = `€${currentPrice.toFixed(6)}`;
        
        // Update price change
        const priceChange = this.calculatePriceChange();
        const priceChangeEl = document.getElementById('priceChange');
        const chartPriceChangeEl = document.getElementById('chartPriceChange');
        
        priceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
        priceChangeEl.className = `price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
        
        chartPriceChangeEl.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
        chartPriceChangeEl.className = `chart-price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
        
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
        const recentTrades = this.trades.slice(0, 20); // Was 10, nu 20 voor meer zichtbare trades
        
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
                datasets: [
                    {
                        label: 'YNG Price',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return null;
                            
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
                            gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.1)');
                            gradient.addColorStop(1, 'rgba(0, 255, 136, 0.01)');
                            return gradient;
                        },
                        borderWidth: 3,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#00ff88',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Volume',
                        data: [],
                        type: 'bar',
                        backgroundColor: 'rgba(0, 210, 255, 0.2)',
                        borderColor: 'rgba(0, 210, 255, 0.4)',
                        borderWidth: 1,
                        yAxisID: 'volume',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                backgroundColor: 'rgba(26, 26, 46, 0.95)',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#00ff88',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                const date = new Date(context[0].parsed.x);
                                return date.toLocaleString();
                            },
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Price: €${context.parsed.y.toFixed(6)}`;
                                } else {
                                    return `Volume: €${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'MMM dd'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: {
                                size: 11
                            },
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return '€' + value.toFixed(6);
                            },
                            maxTicksLimit: 8
                        }
                    },
                    volume: {
                        type: 'linear',
                        position: 'left',
                        max: function(context) {
                            const maxVolume = Math.max(...context.chart.data.datasets[1].data.map(d => d.y || 0));
                            return maxVolume * 4; // Make volume bars smaller relative to chart
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                elements: {
                    point: {
                        radius: 0
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        this.updateChart();
    }

    updateChart() {
        if (!this.chart) return;
        
        const priceData = this.getChartData(this.chartTimeframe);
        const volumeData = this.getVolumeData(this.chartTimeframe);
        
        this.chart.data.datasets[0].data = priceData;
        this.chart.data.datasets[1].data = volumeData;
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

    getVolumeData(timeframe) {
        const now = Date.now();
        let startTime;
        let interval;
        
        switch (timeframe) {
            case '1h':
                startTime = now - (60 * 60 * 1000);
                interval = 5 * 60 * 1000; // 5 minute intervals
                break;
            case '4h':
                startTime = now - (4 * 60 * 60 * 1000);
                interval = 15 * 60 * 1000; // 15 minute intervals
                break;
            case '1d':
                startTime = now - (24 * 60 * 60 * 1000);
                interval = 60 * 60 * 1000; // 1 hour intervals
                break;
            case '7d':
                startTime = now - (7 * 24 * 60 * 60 * 1000);
                interval = 4 * 60 * 60 * 1000; // 4 hour intervals
                break;
            default:
                startTime = now - (60 * 60 * 1000);
                interval = 5 * 60 * 1000;
        }
        
        const filteredTrades = this.trades.filter(trade => trade.timestamp >= startTime);
        const volumePoints = [];
        
        // Group trades by time intervals
        for (let time = startTime; time <= now; time += interval) {
            const intervalTrades = filteredTrades.filter(trade => 
                trade.timestamp >= time && trade.timestamp < time + interval
            );
            
            const volume = intervalTrades.reduce((sum, trade) => sum + trade.eurAmount, 0);
            
            if (volume > 0 || volumePoints.length > 0) {
                volumePoints.push({
                    x: time + (interval / 2), // Center of interval
                    y: volume
                });
            }
        }
        
        return volumePoints;
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
        this.saveAITraders();
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

    saveAITraders() {
        localStorage.setItem('yngTradingAITraders', JSON.stringify(this.aiTraders));
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

    loadAITraders() {
        const data = localStorage.getItem('yngTradingAITraders');
        return data ? JSON.parse(data) : [];
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
