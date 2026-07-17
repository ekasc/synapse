const timer = document.getElementById('timer');
const course = document.getElementById('course');
const intention = document.getElementById('intention');

function format(seconds) {
	return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

async function refresh() {
	const response = await chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATE' });
	const session = response?.result;
	if (!session?.active) return window.close();
	course.textContent = session.course || 'Focus session';
	intention.textContent = session.intention || 'Return to your study session.';
	const update = () => {
		const seconds = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
		timer.textContent = format(seconds);
		if (!seconds) window.close();
	};
	update();
	setInterval(update, 250);
}

document
	.getElementById('return')
	.addEventListener('click', () => (history.length > 1 ? history.back() : window.close()));
document.getElementById('override').addEventListener('click', async () => {
	await chrome.runtime.sendMessage({ type: 'BEGIN_OVERRIDE' });
	history.length > 1 ? history.back() : window.close();
});

refresh();
