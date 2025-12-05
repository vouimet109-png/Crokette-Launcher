// Game Library Loader
class GameLibrary {
	constructor() {
		this.games = [];
		this.gameContainer = document.getElementById('gamesList');
		this.init();
	}

	async init() {
		await this.scanGameFolders();
		this.renderGames();
	}

	async scanGameFolders() {
		try {
			// First try a static manifest file listing game folders (works on static hosts)
			const manifestResp = await fetch('game/games.json');
			if (manifestResp.ok) {
				const folders = await manifestResp.json();
				if (Array.isArray(folders)) {
					for (const folderName of folders) {
						const game = await this.loadGameMetadata(folderName);
						if (game) this.games.push(game);
					}
					return;
				}
			}

			// Fallback: try to read a directory listing (only works if the server exposes it)
			const response = await fetch('game/');
			const html = await response.text();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			const links = doc.querySelectorAll('a');

			for (const link of links) {
				const href = link.getAttribute('href');
				// Filter out non-folder links
				if (href && !href.includes('.') && href !== '/' && href !== '../' && href !== 'game/') {
					const gameFolder = href.replace(/\/$/, '');
					const game = await this.loadGameMetadata(gameFolder);
					if (game) this.games.push(game);
				}
			}
		} catch (error) {
			console.error('Error scanning game folders:', error);
		}
	}

	async loadGameMetadata(folderName) {
		try {
			// Try to load github.json (must exist to display the game)
			const jsonResponse = await fetch(`game/${folderName}/github.json`);

			if (!jsonResponse.ok) {
				console.warn(`github.json not found for ${folderName}`);
				return null; // do not show games without github.json
			}

			const metadata = await jsonResponse.json();

			// Determine cover image: prefer game/<folder>/cover.png, else use project-level png/unknown.png
			const coverCandidates = [
				`game/${folderName}/cover.png`,
				`../png/unknown.png`,
				`png/unknown.png`
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

			return {
				id: folderName,
				name: metadata.name || folderName,
				description: metadata.description || 'No description available',
				version: metadata.version || '1.0.0',
				downloadUrl: metadata.downloadUrl || '#',
				size: metadata.size || 'Unknown',
				cover: usedCover, // will be null only if no candidate exists
				comingSoon: metadata.comingSoon || false
			};
		} catch (error) {
			console.error(`Failed to load game metadata for ${folderName}:`, error);
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
