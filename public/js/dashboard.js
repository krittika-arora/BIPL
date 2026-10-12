// Draws the weekly completions chart from the JSON the server embeds in the page.
(function drawCompletionsChart() {
  const dataElement = document.getElementById('weekly-completions-data');
  const canvas = document.getElementById('weekly-completions-chart');
  if (!dataElement || !canvas || typeof window.Chart === 'undefined') return;

  const weeks = JSON.parse(dataElement.textContent);

  // eslint-disable-next-line no-new
  new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map((week) => week.label),
      datasets: [
        {
          label: 'Completions',
          data: weeks.map((week) => week.count),
          backgroundColor: 'rgba(25, 135, 84, 0.75)',
          borderRadius: 4,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Week of ${items[0].label}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}());
