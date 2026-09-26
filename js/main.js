/*
 * Portfolio scripts
 *  - light/dark theme toggle
 *  - navbar (scroll shadow, active section, mobile menu)
 *  - contact details, email menu and copy buttons
 *  - the little atlas viewer in the hero
 */

const root = document.documentElement;
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initNavbar();
  initContactDetails();
  initCopyButtons();
  initAtlasViewer();

  document.getElementById('year').textContent = new Date().getFullYear();
});


/* ---------- Theme ---------- */

// The saved theme is applied by a tiny inline script in <head> so the page
// doesn't flash the wrong colours before this file loads.

function isDarkMode() {
  const theme = root.getAttribute('data-theme');
  return theme ? theme === 'dark' : darkModeQuery.matches;
}

function initThemeToggle() {
  const button = document.getElementById('theme-toggle');

  const updateButton = () => button.setAttribute('aria-pressed', isDarkMode());
  updateButton();

  button.addEventListener('click', () => {
    const next = isDarkMode() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    updateButton();

    try {
      localStorage.setItem('theme', next);
    } catch (err) {
      // private mode / storage disabled - the toggle still works for this visit
    }
  });

  darkModeQuery.addEventListener('change', updateButton);
}


/* ---------- Navbar ---------- */

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const menuButton = document.getElementById('menu-toggle');
  const links = document.querySelectorAll('.nav-links a');

  // Shadow under the bar once the page is scrolled
  const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight the link for whichever section is in the middle of the screen.
  // Only in-page links (#work etc.) - the resume link points to a file.
  const sectionLinks = [...links].filter(link => link.getAttribute('href').startsWith('#'));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      sectionLinks.forEach(link => {
        if (link.getAttribute('href') === '#' + entry.target.id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  sectionLinks.forEach(link => {
    const section = document.getElementById(link.getAttribute('href').slice(1));
    if (section) observer.observe(section);
  });

  // Watching the hero too means the highlight clears when you scroll back up
  observer.observe(document.getElementById('top'));

  // Mobile menu
  const setMenuOpen = open => {
    navbar.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', open);
  };

  menuButton.addEventListener('click', () => {
    setMenuOpen(!navbar.classList.contains('is-open'));
  });

  links.forEach(link => link.addEventListener('click', () => setMenuOpen(false)));

  document.addEventListener('click', event => {
    if (!navbar.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navbar.classList.contains('is-open')) {
      setMenuOpen(false);
      menuButton.focus();
    }
  });
}


/* ---------- Contact ---------- */

// Email and phone are stored reversed in data attributes so simple scrapers
// can't pick them out of the HTML. We flip them back here.
const reverse = text => text.split('').reverse().join('');

function initContactDetails() {
  const emailLink = document.getElementById('email');
  const phoneLink = document.getElementById('phone');

  const email = reverse(emailLink.dataset.user) + '@' + reverse(emailLink.dataset.domain);
  const phone = reverse(phoneLink.dataset.number);

  emailLink.textContent = email;
  emailLink.href = 'mailto:' + email;

  phoneLink.textContent = phone;
  phoneLink.href = 'tel:' + phone.replace(/\s/g, '');

  initMailMenu(emailLink, email);
}

// mailto: does nothing if the visitor has no desktop mail app set up,
// so clicking the address offers the common web mail clients as well.
function initMailMenu(emailLink, email) {
  const menu = document.getElementById('mail-menu');
  const to = encodeURIComponent(email);

  document.getElementById('mail-gmail').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`;
  document.getElementById('mail-outlook').href = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}`;
  document.getElementById('mail-yahoo').href = `https://compose.mail.yahoo.com/?to=${to}`;
  document.getElementById('mail-default').href = `mailto:${email}`;

  const setMenuOpen = open => {
    menu.hidden = !open;
    emailLink.setAttribute('aria-expanded', open);
    if (open) menu.querySelector('a').focus();
  };

  emailLink.addEventListener('click', event => {
    event.preventDefault();
    setMenuOpen(menu.hidden);
  });

  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setMenuOpen(false);
  });

  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== emailLink) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setMenuOpen(false);
      emailLink.focus();
    }
  });
}

function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copy);
      const text = target.textContent.trim();

      try {
        await navigator.clipboard.writeText(text);
        flashLabel(button, 'Copied');
      } catch (err) {
        // Clipboard API is blocked on plain http / some browsers:
        // select the text instead so the user can copy it themselves.
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        flashLabel(button, 'Selected');
      }
    });
  });
}

function flashLabel(button, label) {
  button.textContent = label;
  setTimeout(() => (button.textContent = 'Copy'), 1600);
}


/* ---------- Atlas viewer ---------- */

// A fake brain section drawn on a canvas: hover (or tap / use arrow keys)
// to see region names, and switch between axial, coronal and sagittal.

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 460;
const MICRONS_PER_PIXEL = 62.5; // so the 80px scale bar = 5 mm

// Each region: [name, centreX, centreY, radiusX, radiusY, seed]
const PLANES = [
  {
    name: 'Axial',
    outline: [280, 230, 215, 185],
    regions: [
      ['Frontal cortex', 280, 110, 120, 55, 3],
      ['Thalamus', 280, 235, 60, 42, 7],
      ['Occipital cortex', 280, 360, 105, 45, 11],
      ['Lateral ventricle', 225, 210, 22, 55, 5],
      ['Lateral ventricle', 335, 210, 22, 55, 6],
    ],
  },
  {
    name: 'Coronal',
    outline: [280, 215, 225, 170],
    regions: [
      ['Cingulate cortex', 280, 115, 90, 32, 4],
      ['Caudate nucleus', 225, 200, 34, 40, 8],
      ['Caudate nucleus', 335, 200, 34, 40, 9],
      ['Thalamus', 280, 255, 62, 40, 2],
      ['Hippocampus', 185, 305, 46, 24, 12],
      ['Hippocampus', 375, 305, 46, 24, 13],
      ['Brainstem', 280, 380, 40, 55, 14],
    ],
  },
  {
    name: 'Sagittal',
    outline: [270, 205, 230, 160],
    regions: [
      ['Corpus callosum', 270, 175, 120, 20, 21],
      ['Thalamus', 290, 225, 50, 34, 22],
      ['Cerebellum', 400, 320, 70, 50, 23],
      ['Brainstem', 320, 350, 32, 70, 24],
      ['Frontal cortex', 120, 190, 70, 80, 25],
    ],
  },
];

// Small seeded random generator so the drawing looks the same on every load
function seededRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// An ellipse with a wobbly edge, returned as a list of [x, y] points
function wobblyEllipse(cx, cy, rx, ry, seed, wobble) {
  const random = seededRandom(seed * 997 + 13);
  const phase = [random() * 6, random() * 6, random() * 6];
  const points = [];

  for (let i = 0; i <= 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const noise =
      Math.sin(3 * angle + phase[0]) * 0.5 +
      Math.sin(5 * angle + phase[1]) * 0.3 +
      Math.sin(8 * angle + phase[2]) * 0.2;
    const scale = 1 + wobble * noise;

    points.push([cx + Math.cos(angle) * rx * scale, cy + Math.sin(angle) * ry * scale]);
  }

  return points;
}

// Standard ray-casting point-in-polygon test
function isPointInside(points, x, y) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }

  return inside;
}

function initAtlasViewer() {
  const canvas = document.getElementById('atlas-canvas');
  const ctx = canvas.getContext('2d');
  const regionLabel = document.getElementById('region-name');
  const xLabel = document.getElementById('cursor-x');
  const yLabel = document.getElementById('cursor-y');
  const planeButtons = document.querySelectorAll('.plane-switch button');

  let currentPlane = 1; // start on coronal
  let cursor = null;    // [x, y] in canvas units, or null when not hovering
  let frameRequest = 0;
  let colors = {};
  const shapeCache = {};

  // Sharp rendering on high-DPI screens
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VIEW_WIDTH * pixelRatio;
  canvas.height = VIEW_HEIGHT * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // Read the CSS colour variables once per theme change instead of every frame
  function readColors() {
    const style = getComputedStyle(root);
    const get = name => style.getPropertyValue(name).trim();

    colors = {
      stain: get('--stain'),
      tissue: get('--tissue'),
      tissueDark: get('--tissue-2'),
      ink: get('--ink'),
      accent: get('--accent'),
      grid: get('--line'),
    };
  }

  // Build (and cache) the outline, regions, folds and cells for a plane
  function getShapes(planeIndex) {
    if (shapeCache[planeIndex]) return shapeCache[planeIndex];

    const plane = PLANES[planeIndex];
    const [cx, cy, rx, ry] = plane.outline;
    const outline = wobblyEllipse(cx, cy, rx, ry, planeIndex + 1, 0.06);

    const regions = plane.regions.map(([name, x, y, w, h, seed]) => ({
      name,
      points: wobblyEllipse(x, y, w, h, seed, 0.14),
    }));

    const folds = [];
    for (let i = 0; i < 5; i++) {
      const shrink = 0.86 - i * 0.05;
      folds.push(wobblyEllipse(cx, cy, rx * shrink, ry * shrink, planeIndex * 10 + i + 40, 0.1));
    }

    const random = seededRandom(planeIndex * 31 + 7);
    const cells = [];
    for (let i = 0; i < 1400; i++) {
      const x = random() * VIEW_WIDTH;
      const y = random() * VIEW_HEIGHT;
      if (isPointInside(outline, x, y)) {
        cells.push({ x, y, radius: random() * 1.6 + 0.5, alpha: 0.25 + random() * 0.5 });
      }
    }

    shapeCache[planeIndex] = { outline, regions, folds, cells };
    return shapeCache[planeIndex];
  }

  function tracePath(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
  }

  function drawGrid() {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    for (let x = 40; x < VIEW_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, VIEW_HEIGHT);
      ctx.stroke();
    }

    for (let y = 40; y < VIEW_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(VIEW_WIDTH, y + 0.5);
      ctx.stroke();
    }
  }

  function drawTissue(shapes) {
    tracePath(shapes.outline);
    ctx.fillStyle = colors.tissueDark;
    ctx.fill();

    // folds and cells are clipped to the tissue outline
    ctx.save();
    tracePath(shapes.outline);
    ctx.clip();

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = colors.stain;
    ctx.lineWidth = 1.2;
    shapes.folds.forEach(fold => {
      tracePath(fold);
      ctx.stroke();
    });

    ctx.fillStyle = colors.stain;
    shapes.cells.forEach(cell => {
      ctx.globalAlpha = cell.alpha;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawRegions(shapes, hoveredName) {
    shapes.regions.forEach(region => {
      // left and right regions share a name, so both light up together
      const isHovered = region.name === hoveredName;

      tracePath(region.points);
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = isHovered ? 0.28 : 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.setLineDash(isHovered ? [] : [4, 3]);
      ctx.lineWidth = isHovered ? 2 : 1.2;
      ctx.strokeStyle = colors.accent;
      ctx.stroke();
      ctx.setLineDash([]);
    });

    tracePath(shapes.outline);
    ctx.strokeStyle = colors.stain;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawLabels() {
    ctx.fillStyle = colors.ink;
    ctx.fillRect(VIEW_WIDTH - 110, VIEW_HEIGHT - 24, 80, 3); // 5 mm scale bar
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('5 mm', VIEW_WIDTH - 86, VIEW_HEIGHT - 32);
    ctx.fillText(PLANES[currentPlane].name.toUpperCase(), 14, VIEW_HEIGHT - 18);
  }

  function drawCrosshair() {
    const [x, y] = cursor;

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, VIEW_HEIGHT);
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW_WIDTH, y + 0.5);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw() {
    frameRequest = 0;
    const shapes = getShapes(currentPlane);

    const hovered = cursor && shapes.regions.find(region => isPointInside(region.points, cursor[0], cursor[1]));
    const hoveredName = hovered ? hovered.name : null;

    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = colors.tissue;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    drawGrid();
    drawTissue(shapes);
    drawRegions(shapes, hoveredName);
    drawLabels();
    if (cursor) drawCrosshair();

    let text = 'Hover or tap the section';
    if (hoveredName) text = hoveredName;
    else if (cursor) text = 'Outside labelled regions';

    // only touch the DOM when it changes, so screen readers don't repeat it
    if (regionLabel.textContent !== text) regionLabel.textContent = text;
  }

  // Batch redraws to one per animation frame
  function requestDraw() {
    if (!frameRequest) frameRequest = requestAnimationFrame(draw);
  }

  function setCursor(point) {
    if (point) {
      const x = Math.max(0, Math.min(VIEW_WIDTH, point[0]));
      const y = Math.max(0, Math.min(VIEW_HEIGHT, point[1]));
      cursor = [x, y];
      xLabel.textContent = Math.round(x * MICRONS_PER_PIXEL).toLocaleString();
      yLabel.textContent = Math.round(y * MICRONS_PER_PIXEL).toLocaleString();
    } else {
      cursor = null;
      xLabel.textContent = '—';
      yLabel.textContent = '—';
    }

    requestDraw();
  }

  // Convert a pointer event to canvas coordinates
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
      ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    ];
  }

  canvas.addEventListener('pointerdown', event => setCursor(pointerPosition(event)));
  canvas.addEventListener('pointermove', event => setCursor(pointerPosition(event)));

  // On touch we keep the crosshair after the finger lifts so the label stays readable
  canvas.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') setCursor(null);
  });

  // Keyboard: arrows move the crosshair (Shift for bigger steps), Esc clears it
  canvas.addEventListener('keydown', event => {
    const step = event.shiftKey ? 40 : 10;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];

    if (move) {
      event.preventDefault();
      // first key press drops the crosshair in the centre
      if (!cursor) setCursor([VIEW_WIDTH / 2, VIEW_HEIGHT / 2]);
      else setCursor([cursor[0] + move[0], cursor[1] + move[1]]);
    } else if (event.key === 'Escape') {
      setCursor(null);
    }
  });

  canvas.addEventListener('blur', () => setCursor(null));

  planeButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentPlane = Number(button.dataset.plane);
      planeButtons.forEach(other => other.setAttribute('aria-pressed', other === button));

      const planeName = PLANES[currentPlane].name.toLowerCase();
      canvas.setAttribute(
        'aria-label',
        `Illustrated ${planeName} brain section with labelled regions. Use the arrow keys to move the crosshair.`
      );

      requestDraw();
    });
  });

  // Redraw with the new palette when the theme changes
  const onThemeChange = () => {
    readColors();
    requestDraw();
  };
  darkModeQuery.addEventListener('change', onThemeChange);
  new MutationObserver(onThemeChange).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  readColors();
  draw();

  // the canvas label uses JetBrains Mono, so redraw once the web font is ready
  if (document.fonts) document.fonts.ready.then(requestDraw);
}
