// Game Library Loader
class GameLibrary {
	constructor() {
		this.games = [];
		this.gameContainer = document.getElementById('gamesList');
		this.init();
	}

	async init() {
		this.basePath = 'games/'; // on GitHub Pages the games folder lives under the site root
		await this.scanGameFolders();
		this.renderGames();
	}

	async scanGameFolders() {
		const base = this.basePath;
		console.log('[gamecode] scanning game folders from:', base);
		// First, try a simple index file on the repo to avoid GitHub API rate limits.
		// Create `games/index.txt` in the repo with one folder name per line (optional but recommended).
		const indexUrl = 'https://raw.githubusercontent.com/vouimet109-png/Crokette-Launcher/main/games/index.txt';
		try {
			console.log('[gamecode] trying index file:', indexUrl);
			const idxResp = await fetch(indexUrl);
			if (idxResp.ok) {
				const text = await idxResp.text();
				const folders = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
				console.log('[gamecode] index file folders:', folders);
				for (const folderName of folders) {
					const game = await this.loadGameMetadata(folderName);
					if (game) this.games.push(game);
				}
				if (this.games.length > 0) return;
			}
		} catch (e) {
			console.log('[gamecode] index file not found or failed:', e);
		}

		// Second, try the GitHub API to list directories in the games folder
		try {
			const apiUrl = 'https://api.github.com/repos/vouimet109-png/Crokette-Launcher/contents/games';
			console.log('[gamecode] trying GitHub API:', apiUrl);
			const apiResp = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
			if (apiResp.ok) {
				const contents = await apiResp.json();
				const folders = contents.filter(item => item.type === 'dir').map(item => item.name);
				console.log('[gamecode] found folders from API:', folders);
				for (const folderName of folders) {
					const game = await this.loadGameMetadata(folderName);
					if (game) this.games.push(game);
				}
				if (this.games.length > 0) return;
			} else {
				console.warn('[gamecode] GitHub API returned status:', apiResp.status);
			}
		} catch (e) {
			console.error('[gamecode] GitHub API error:', e);
		}

		// Final fallback: try a small known list (useful for quick local dev)
		console.warn('[gamecode] falling back to known list');
		const fallback = ['mario'];
		for (const folderName of fallback) {
			try {
				const game = await this.loadGameMetadata(folderName);
				if (game) this.games.push(game);
			} catch (e) { /* ignore */ }
		}
	}

	async loadGameMetadata(folderName) {
		try {
			// Determine base path to use for this game
			const base = this.basePath || 'games/';
			const jsonUrl = `${base}${folderName}/github.json?t=${Date.now()}`;
			console.log('[gamecode] fetching metadata from:', jsonUrl);
			
			// Try to load github.json (must exist to display the game)
			const jsonResponse = await fetch(jsonUrl);

			if (!jsonResponse.ok) {
				console.warn(`[gamecode] github.json not found for ${folderName}, status:`, jsonResponse.status);
				return null; // do not show games without github.json
			}

			const metadata = await jsonResponse.json();
			console.log('[gamecode] metadata loaded:', metadata);

			// Determine cover image: prefer game/<folder>/cover.png, else use project-level png/unknown.png
			const coverCandidates = [
				`${base}${folderName}/cover.png?t=${Date.now()}`,
				`../png/unknown.png?t=${Date.now()}`,
				`png/unknown.png?t=${Date.now()}`
			];

			let usedCover = null;
			for (const url of coverCandidates) {
				try {
					const r = await fetch(url);
					if (r.ok) { usedCover = url; break; }
				} catch (e) {
					// ignore and try next
				}
			}

			const gameData = {
				id: folderName,
				name: metadata.name || folderName,
				description: metadata.description || 'No description available',
				version: metadata.version || '1.0.0',
				downloadUrl: metadata.downloadUrl || '#',
				size: metadata.size || 'Unknown',
				cover: usedCover, // will be null only if no candidate exists
				comingSoon: metadata.comingSoon || false
			};
			console.log('[gamecode] game data prepared:', gameData);
			return gameData;
		} catch (error) {
			console.error(`[gamecode] Failed to load game metadata for ${folderName}:`, error);
			return null;
		}
	}

	renderGames() {
		if (!this.gameContainer) {
			console.error('Games container not found');
			return;
		}

		this.gameContainer.innerHTML = '';

		if (this.games.length === 0) {
			this.gameContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; opacity: 0.7;">No games found</p>';
			return;
		}

		this.games.forEach(game => {
			const gameCard = this.createGameCard(game);
			this.gameContainer.appendChild(gameCard);
		});
	}

	createGameCard(game) {
		const card = document.createElement('div');
		card.className = 'game-card';
		
		let content = '';

		// Add cover image if available
		if (game.cover) {
			content += `<img src="${game.cover}" alt="${game.name}" class="game-card-image">`;
		} else {
			content += `<div class="game-card-image" style="background: rgba(0,212,255,0.1); display: flex; align-items: center; justify-content: center; color: rgba(0,212,255,0.5);">No Cover</div>`;
		}

		content += `
			<div class="game-card-title">${game.name}</div>
			<div class="game-card-desc">${game.description}</div>
			<div style="font-size: 11px; opacity: 0.6; margin-bottom: 10px;">
				<div>v${game.version}</div>
				<div>${game.size}</div>
			</div>
		`;

		if (game.comingSoon) {
			content += `<div style="background: rgba(255,165,0,0.2); border: 1px solid rgba(255,165,0,0.5); border-radius: 4px; padding: 6px; text-align: center; font-size: 11px; color: #ffb366; margin-bottom: 10px;">Coming Soon</div>`;
		} else {
			content += `<a href="${game.downloadUrl}" target="_blank" class="btn btn-primary" style="display: block; text-align: center; text-decoration: none; margin-bottom: 0; padding: 8px; font-size: 12px;">Download</a>`;
		}

		card.innerHTML = content;
		return card;
	}
}

// Initialize the game library when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		new GameLibrary();
	});
} else {
	new GameLibrary();
}
