// Admin panel logic
class AdminPanel {
	constructor() {
		this.games = [];
		this.selectedGameId = null;
		this.selectedImage = null;
		this.isElectron = (typeof window !== 'undefined' && typeof window.api !== 'undefined' && window.api && window.api.admin && typeof window.api.admin.saveGames === 'function');
		this.init();
	}
	
	init() {
		this.loadGames();
		this.setupEventListeners();
	}
	
	setupEventListeners() {
 		// If we're running inside Electron with the preload API, attach mutation handlers.
 		if (this.isElectron) {
 			document.getElementById('saveBtn').addEventListener('click', () => this.saveGame());
 			document.getElementById('resetBtn').addEventListener('click', () => this.resetForm());
 			document.getElementById('imageUpload').addEventListener('click', () => {
 				document.getElementById('imageFile').click();
 			});
 			document.getElementById('imageFile').addEventListener('change', (e) => this.handleImageSelect(e));
 			const pubBtn = document.getElementById('publishBtn');
 			if (pubBtn) pubBtn.addEventListener('click', () => this.publishToGitHub());
		} else {
			// Disable/hide mutation controls in public (non-Electron) mode
			const controls = ['saveBtn','resetBtn','imageUpload','imageFile','ghOwner','ghRepo','ghPath','ghToken','ghMessage','publishBtn'];
			controls.forEach(id => {
				const el = document.getElementById(id);
				if (!el) return;
				el.disabled = true;
				if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') el.style.opacity = '0.6';
			});
			// Hide image selection button (keeps preview visible)
			const imgUpload = document.getElementById('imageUpload');
			if (imgUpload) imgUpload.style.display = 'none';
		}
	}
	
	async loadGames() {
		try {
			// Try to load from game/ folder first (auto-detect)
			const folderGames = await this.scanGameFolder();
			if (folderGames && folderGames.length > 0) {
				this.games = folderGames;
			} else {
				// Fallback to data/games.json if no games found in folder
				const response = await fetch('data/games.json');
				const data = await response.json();
				this.games = data.games || [];
			}
			this.renderGames();
			this.updateStats();
		} catch (e) {
			console.error('Failed to load games', e);
			this.showAlert('Failed to load games', 'error');
		}
	}
	
	async scanGameFolder() {
		try {
			// Fetch list of game folders from game/ directory
			const response = await fetch('game/');
			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			const links = doc.querySelectorAll('a');
			const games = [];
			
			for (const link of links) {
				const href = link.getAttribute('href');
				if (href && !href.includes('.') && href !== '/' && href !== '../') {
					const gameFolder = href.replace(/\/$/, '');
					try {
						const game = await this.loadGameFromFolder(gameFolder);
						if (game) games.push(game);
					} catch (err) {
						console.warn(`Failed to load game from ${gameFolder}:`, err);
					}
				}
			}
			return games.length > 0 ? games : null;
		} catch (e) {
			console.log('No game folder detection available (expected in static hosting):', e);
			return null;
		}
	}
	
	async loadGameFromFolder(folderName) {
		try {
			// Load package.json from game folder
			const pkgResponse = await fetch(`game/${folderName}/package.json`);
			if (!pkgResponse.ok) return null;
			const pkg = await pkgResponse.json();
			
			// Load Cover.png as image
			let image = null;
			try {
				const imgResponse = await fetch(`game/${folderName}/Cover.png`);
				if (imgResponse.ok) {
					const blob = await imgResponse.blob();
					const reader = new FileReader();
					image = await new Promise((resolve) => {
						reader.onload = () => resolve(reader.result.split(',')[1]);
						reader.readAsDataURL(blob);
					});
				}
			} catch (imgErr) {
				console.warn(`No Cover.png found for ${folderName}`);
			}
			
			const game = {
				id: pkg.gameId || folderName,
				name: pkg.name || folderName,
				desc: pkg.description || 'No description',
				downloadUrl: pkg.downloadUrl || `game/${folderName}/`,
				size: pkg.size || 'Unknown',
				version: pkg.version || '1.0.0',
				comingSoon: pkg.comingSoon || false,
				image: image
			};
			
			return game;
		} catch (e) {
			console.error(`Error loading game from folder ${folderName}:`, e);
			return null;
		}
	}
	
	renderGames() {
		const gamesList = document.getElementById('gamesList');
		gamesList.innerHTML = '';
		
		this.games.forEach(game => {
			const card = document.createElement('div');
			card.className = 'game-card' + (this.selectedGameId === game.id ? ' selected' : '');
			card.innerHTML = `
 					${game.image ? `<img src="data:image/jpeg;base64,${game.image}" class="game-card-image">` : '<div class="game-card-image" style="background: rgba(0,212,255,0.1); display: flex; align-items: center; justify-content: center;">No Image</div>'}
 					<div class="game-card-title">${game.name}</div>
 					<div class="game-card-desc">${game.desc}</div>
 					<div class="game-card-actions">
 						${this.isElectron ? `<button class="btn" style="background: #00d4ff; color: #001a33; flex: 1;" onclick="admin.selectGame('${game.id}')">Edit</button>
 						<button class="btn btn-danger" onclick="admin.deleteGame('${game.id}')">Delete</button>` : `<button class="btn" disabled style="background: #bbb; color: #666; flex: 1;">Read-only</button>`}
 					</div>
			`;
			gamesList.appendChild(card);
		});
	}
	
	selectGame(gameId) {
		const game = this.games.find(g => g.id === gameId);
		if (!game) return;
		
		this.selectedGameId = gameId;
		document.getElementById('gameId').value = game.id;
		document.getElementById('gameName').value = game.name;
		document.getElementById('gameDesc').value = game.desc;
		document.getElementById('gameUrl').value = game.downloadUrl;
		document.getElementById('gameSize').value = game.size;
		document.getElementById('gameVersion').value = game.version;
		document.getElementById('comingSoon').checked = game.comingSoon || false;
		
		this.selectedImage = null;
		const preview = document.getElementById('imagePreview');
		if (game.image) {
			preview.src = `data:image/jpeg;base64,${game.image}`;
			preview.style.display = 'block';
		} else {
			preview.style.display = 'none';
		}
		
		this.renderGames();
	}
	
	resetForm() {
		document.getElementById('gameId').value = '';
		document.getElementById('gameName').value = '';
		document.getElementById('gameDesc').value = '';
		document.getElementById('gameUrl').value = '';
		document.getElementById('gameSize').value = '';
		document.getElementById('gameVersion').value = '1.0.0';
		document.getElementById('comingSoon').checked = false;
		document.getElementById('imagePreview').style.display = 'none';
		this.selectedImage = null;
		this.selectedGameId = null;
		this.renderGames();
	}
	
	handleImageSelect(e) {
		const file = e.target.files[0];
		if (!file) return;
		
		const reader = new FileReader();
		reader.onload = (ev) => {
			this.selectedImage = ev.target.result.split(',')[1]; // Get base64
			const preview = document.getElementById('imagePreview');
			preview.src = ev.target.result;
			preview.style.display = 'block';
		};
		reader.readAsDataURL(file);
	}
	
	async saveGame() {
		const gameId = document.getElementById('gameId').value;
		const gameName = document.getElementById('gameName').value;
		const gameDesc = document.getElementById('gameDesc').value;
		const gameUrl = document.getElementById('gameUrl').value;
		const gameSize = document.getElementById('gameSize').value;
		const gameVersion = document.getElementById('gameVersion').value;
		const comingSoon = document.getElementById('comingSoon').checked;
		
		if (!gameName || !gameDesc || !gameUrl) {
			this.showAlert('Please fill all required fields (*)', 'error');
			return;
		}
		
		const newGame = {
			id: gameId || `g${Date.now()}`,
			name: gameName,
			desc: gameDesc,
			downloadUrl: gameUrl,
			size: gameSize || 'Unknown',
			version: gameVersion,
			comingSoon: comingSoon,
			image: this.selectedImage || (gameId && this.games.find(g => g.id === gameId)?.image) || null
		};
		
		if (gameId) {
			const idx = this.games.findIndex(g => g.id === gameId);
			if (idx >= 0) {
				this.games[idx] = newGame;
			}
		} else {
			this.games.push(newGame);
		}
		
		// Save to games.json
		await this.saveGamesJSON();
		this.resetForm();
		this.loadGames();
		this.showAlert(`Game "${gameName}" saved successfully!`, 'success');
	}
	
	async deleteGame(gameId) {
		if (!confirm('Are you sure you want to delete this game?')) return;
		
		const game = this.games.find(g => g.id === gameId);
		this.games = this.games.filter(g => g.id !== gameId);
		
		await this.saveGamesJSON();
		this.resetForm();
		this.loadGames();
		this.showAlert(`Game "${game.name}" deleted!`, 'success');
	}
	
	async saveGamesJSON() {
		try {
 			if (!this.isElectron) throw new Error('Read-only mode: cannot save');
 			await window.api.admin.saveGames(this.games);
		} catch (e) {
			console.error('Failed to save games', e);
 			this.showAlert('Failed to save games to file', 'error');
		}
	}

	async publishToGitHub() {
		const owner = document.getElementById('ghOwner').value.trim();
		const repo = document.getElementById('ghRepo').value.trim();
		const filePath = document.getElementById('ghPath').value.trim() || 'data/games.json';
		const token = document.getElementById('ghToken').value.trim();
		const message = document.getElementById('ghMessage').value.trim() || `Update games.json via admin`;
		
		if (!owner || !repo || !token) {
			this.showAlert('Please provide GitHub owner, repo and token to publish.', 'error');
			return;
		}
		
 		if (!this.isElectron) {
 			this.showAlert('Read-only mode: cannot publish to GitHub from public site.', 'error');
 			return;
 		}
 		try {
 			const payload = { games: this.games };
 			const res = await window.api.admin.publishGames({ owner, repo, filePath, token, message, payload });
 			if (res && res.ok) {
 				this.showAlert('Published to GitHub successfully', 'success');
 			} else {
 				console.error('Publish failed', res);
 				this.showAlert('Failed to publish to GitHub: ' + (res && res.error ? res.error : 'unknown'), 'error');
 			}
 		} catch (e) {
 			console.error('Publish error', e);
 			this.showAlert('Publish error: ' + e.message, 'error');
 		}
	}
	
	updateStats() {
		const total = this.games.length;
		const active = this.games.filter(g => !g.comingSoon).length;
		const comingSoon = this.games.filter(g => g.comingSoon).length;
		
		document.getElementById('statTotal').textContent = total;
		document.getElementById('statActive').textContent = active;
		document.getElementById('statComingSoon').textContent = comingSoon;
	}
	
	showAlert(msg, type) {
		const container = document.getElementById('alertContainer');
		const alert = document.createElement('div');
		alert.className = `alert alert-${type}`;
		alert.textContent = msg;
		container.appendChild(alert);
		
		setTimeout(() => alert.remove(), 3000);
	}
}

// Initialize
let admin;
document.addEventListener('DOMContentLoaded', () => {
	admin = new AdminPanel();
});
