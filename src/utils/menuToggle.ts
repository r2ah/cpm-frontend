export function initMenuToggle() {
	console.log('initMenuToggle called');

	if (typeof document === 'undefined') return;

	const toggleBtn = document.querySelector('[data-menu-toggle]') as HTMLElement | null;
	const menu = document.querySelector('[data-menu]') as HTMLElement | null;

	if (!toggleBtn || !menu) return;

	// Evita listeners duplicados si el layout se re-inicializa
	if (toggleBtn.dataset.menuToggled === '1') return;
	toggleBtn.dataset.menuToggled = '1';

	toggleBtn.addEventListener('click', (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		menu.classList.toggle('is-open');
	});

	document.addEventListener('click', (e: MouseEvent) => {
		const target = e.target as Node | null;
		if (!target) return;

		const clickedInsideMenu = menu.contains(target);
		const clickedToggle = toggleBtn.contains(target as Node);

		if (!clickedInsideMenu && !clickedToggle) {
			menu.classList.remove('is-open');
		}
	});

	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			menu.classList.remove('is-open');
		}
	});
}

