/* FlavorLoop SPA - script.js
   Uses TheMealDB (https://www.themealdb.com/api.php)
   Features: Hash router, search + autocomplete, categories, favorites (localStorage)
*/
const API = 'https://www.themealdb.com/api/json/v1/1';

// ------------------- App init & Router -------------------
window.addEventListener('load', () => {
  setupUI();
  updateFavCount();
  router();
});
window.addEventListener('hashchange', router);

function router() {
  const hash = location.hash || '#home';
  if (hash.startsWith('#recipe/')) {
    const id = hash.split('/')[1];
    renderRecipeDetail(id);
  } else if (hash === '#categories') {
    renderCategories();
  } else if (hash === '#favorites') {
    renderFavorites();
  } else if (hash === '#explore') {
    renderExplore();
  } else {
    renderHome();
  }
}

function navigate(hash){
  location.hash = hash;
  closeMobileMenu();
}

// ------------------- UI Setup -------------------
function setupUI(){
  // Search & suggestions handlers
  const input = document.getElementById('searchInput');
  let timer = null;
  input.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (timer) clearTimeout(timer);
    if (!q) { hideSuggestions(); return; }
    timer = setTimeout(() => fetchSuggestions(q), 300);
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      onSearchClick();
      hideSuggestions();
    }
  });

  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.search-area')) hideSuggestions();
  });

  // mobile menu close on resize
  window.addEventListener('resize', closeMobileMenu);
}

// ------------------- Mobile Menu -------------------
function toggleMobileMenu(){
  const m = document.getElementById('mobileMenu');
  if (!m) return;
  if (m.style.display === 'flex') { m.style.display = 'none'; m.setAttribute('aria-hidden','true'); }
  else { m.style.display = 'flex'; m.setAttribute('aria-hidden','false'); }
}
function closeMobileMenu(){
  const m = document.getElementById('mobileMenu');
  if (m) m.style.display = 'none';
}

// ------------------- SUGGESTIONS -------------------
async function fetchSuggestions(q){
  try {
    const res = await fetch(`${API}/search.php?s=${encodeURIComponent(q)}`);
    const json = await res.json();
    showSuggestions(json.meals || []);
  } catch (e) { hideSuggestions(); }
}

function showSuggestions(items){
  const box = document.getElementById('suggestions');
  box.innerHTML = '';
  if (!items || items.length === 0) { box.style.display = 'none'; return; }
  items.slice(0,8).forEach(it => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = it.strMeal;
    div.onclick = () => {
      document.getElementById('searchInput').value = it.strMeal;
      hideSuggestions();
      navigate('#recipe/' + it.idMeal);
    };
    box.appendChild(div);
  });
  box.style.display = 'block';
}
function hideSuggestions(){ const box = document.getElementById('suggestions'); box.style.display = 'none'; box.innerHTML = ''; }

// ------------------- SEARCH -------------------
async function onSearchClick(){
  const q = document.getElementById('searchInput').value.trim();
  if (!q) { alert('Type something to search'); return; }
  const main = document.getElementById('app');
  main.innerHTML = `<div class="page-header"><h2>Results for "${escapeHtml(q)}"</h2></div><div class="small">Searching...</div>`;
  try {
    const res = await fetch(`${API}/search.php?s=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (!json.meals) {
      main.innerHTML = `<div class="page-header"><h2>Results</h2></div><div class="empty">No recipes found for "${escapeHtml(q)}".</div>`;
      return;
    }
    main.innerHTML = `<div class="page-header"><h2>Results for "${escapeHtml(q)}"</h2></div>` + renderGrid(json.meals);
  } catch (e) {
    main.innerHTML = `<div class="empty">Error fetching results.</div>`;
    console.error(e);
  }
}

// ------------------- HOME -------------------
function renderHome(){
  const html = `
    <div class="page-header">
      <h2>Discover recipes</h2>
      <div class="small">Search or explore trending dishes</div>
    </div>
    <section class="grid" id="homeGrid">
      <!-- content will load -->
    </section>
  `;
  document.getElementById('app').innerHTML = html;
  // Show a few popular/quick picks
  const popular = ['Chicken','Pasta','Biryani','Dessert','Seafood'];
  // load one sample from each (use filter by category where available)
  popular.forEach(cat => fetch(`${API}/search.php?s=${encodeURIComponent(cat)}`)
    .then(r=>r.json()).then(j => {
      const node = document.getElementById('homeGrid');
      if (j.meals && j.meals[0]) {
        node.insertAdjacentHTML('beforeend', smallCardHTML(j.meals[0]));
      }
    }).catch(()=>{}));
}

// ------------------- EXPLORE -------------------
function renderExplore(){
  const html = `
    <div class="page-header"><h2>Explore</h2><div class="small">Hand-picked / Random recipes</div></div>
    <div id="exploreGrid" class="grid"></div>
  `;
  document.getElementById('app').innerHTML = html;
  // load some random recipes
  const grid = document.getElementById('exploreGrid');
  grid.innerHTML = '<div class="small">Loading...</div>';
  // fetch 6 random recipes (loop)
  Promise.all(new Array(6).fill(0).map(()=> fetch(`${API}/random.php`).then(r=>r.json())))
    .then(results => {
      const meals = results.map(r => r.meals && r.meals[0]).filter(Boolean);
      grid.innerHTML = meals.map(m => smallCardHTML(m)).join('');
    }).catch(e => {
      grid.innerHTML = '<div class="empty">Unable to load explore recipes.</div>';
    });
}

// ------------------- CATEGORIES -------------------
async function renderCategories(){
  const container = document.getElementById('app');
  container.innerHTML = `<div class="page-header"><h2>Categories</h2><div class="small">Browse by category</div></div><div id="catArea" class="grid">Loading...</div><div id="catMeals" style="margin-top:18px"></div>`;
  try {
    const res = await fetch(`${API}/categories.php`);
    const json = await res.json();
    const cats = json.categories || [];
    document.getElementById('catArea').innerHTML = cats.map(c => `
      <div class="card">
        <img src="${c.strCategoryThumb}" alt="${escapeHtml(c.strCategory)}" />
        <h3>${escapeHtml(c.strCategory)}</h3>
        <div class="small">${escapeHtml(c.strCategoryDescription?.slice(0,80) || '')}...</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-ghost" onclick="openCategory('${encodeURIComponent(c.strCategory)}')">Open</button>
          <button class="btn btn-action" onclick="searchCategory('${encodeURIComponent(c.strCategory)}')">Search</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('catArea').innerHTML = `<div class="empty">Unable to load categories.</div>`;
  }
}

async function openCategory(cat){
  document.getElementById('catMeals').innerHTML = `<div class="small">Loading ${decodeURIComponent(cat)}...</div>`;
  try {
    const res = await fetch(`${API}/filter.php?c=${cat}`);
    const json = await res.json();
    const meals = json.meals || [];
    document.getElementById('catMeals').innerHTML = `<h3>Results: ${decodeURIComponent(cat)}</h3>` + renderGrid(meals);
  } catch (e) {
    document.getElementById('catMeals').innerHTML = `<div class="empty">Failed to load meals.</div>`;
  }
}
function searchCategory(cat){ document.getElementById('searchInput').value = decodeURIComponent(cat); onSearchClick(); }

// ------------------- FAVORITES (localStorage) -------------------
const LS_KEY = 'flavorloop_favorites_v1';
function getFavs(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function saveFavs(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); updateFavCount(); }
function addFav(meal){ const arr = getFavs(); if (!arr.find(m=>m.idMeal===meal.idMeal)) { arr.push({idMeal:meal.idMeal,strMeal:meal.strMeal,strMealThumb:meal.strMealThumb}); saveFavs(arr); } }
function removeFav(id){ const arr = getFavs().filter(m=>m.idMeal!==id); saveFavs(arr); }
function isFav(id){ return !!getFavs().find(m=>m.idMeal===id); }
function updateFavCount(){ const el = document.getElementById('favCount'); if (el) el.textContent = getFavs().length; }

// Render Favorites page
function renderFavorites(){
  const fav = getFavs();
  if (!fav || fav.length === 0) {
    document.getElementById('app').innerHTML = `<div class="page-header"><h2>Favorites</h2></div><div class="empty">You have no saved recipes yet.</div>`;
    return;
  }
  document.getElementById('app').innerHTML = `<div class="page-header"><h2>Favorites</h2><div class="small">Your saved recipes</div></div>` + renderGrid(fav);
}

// ------------------- RECIPE DETAIL -------------------
async function renderRecipeDetail(id){
  const app = document.getElementById('app');
  app.innerHTML = `<div class="small">Loading recipe...</div>`;
  try {
    const res = await fetch(`${API}/lookup.php?i=${id}`);
    const json = await res.json();
    const meal = json.meals && json.meals[0];
    if (!meal) { app.innerHTML = `<div class="empty">Recipe not found.</div>`; return; }

    const ingredients = [];
    for (let i=1;i<=20;i++){
      const ing = meal['strIngredient'+i];
      const measure = meal['strMeasure'+i];
      if (ing && ing.trim()) ingredients.push(`${ing} - ${measure || ''}`);
    }

    const html = `
      <div class="page-header">
        <h2>${escapeHtml(meal.strMeal)}</h2>
        <div class="small">Category: ${escapeHtml(meal.strCategory || '')} • Area: ${escapeHtml(meal.strArea||'')}</div>
      </div>
      <div class="detail">
        <div>
          <img src="${meal.strMealThumb}" alt="${escapeHtml(meal.strMeal)}" />
          <div style="margin-top:10px; display:flex; gap:8px;">
            <button id="favDetailBtn" class="btn ${isFav(meal.idMeal) ? 'btn-ghost' : 'btn-action'}">${isFav(meal.idMeal) ? 'Remove Favorite' : 'Save to Favorites'}</button>
            <a class="btn btn-ghost" href="${meal.strYoutube || '#'}" target="_blank" ${meal.strYoutube ? '' : 'style="display:none"'}>Watch</a>
          </div>
        </div>
        <div>
          <h3>Ingredients</h3>
          <ul class="ingredients">${ingredients.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul>
          <h3>Instructions</h3>
          <p>${escapeHtml(meal.strInstructions || '')}</p>
        </div>
      </div>
    `;
    app.innerHTML = html;

    // fav button handler
    document.getElementById('favDetailBtn').addEventListener('click', () => {
      if (isFav(meal.idMeal)) { removeFav(meal.idMeal); document.getElementById('favDetailBtn').textContent = 'Save to Favorites'; document.getElementById('favDetailBtn').className='btn btn-action'; }
      else { addFav(meal); document.getElementById('favDetailBtn').textContent = 'Remove Favorite'; document.getElementById('favDetailBtn').className='btn btn-ghost'; }
      updateFavCount();
    });

  } catch (e) { app.innerHTML = `<div class="empty">Unable to load recipe.</div>`; console.error(e); }
}

// ------------------- RENDER HELPERS -------------------
function renderGrid(meals){
  if (!meals || meals.length === 0) return `<div class="empty">No results.</div>`;
  return `<div class="grid">${meals.map(m => cardHTML(m)).join('')}</div>`;
}
function cardHTML(m){
  // m might be from filter.php (has idMeal,strMeal,strMealThumb) or favorites stored minimal data
  return `
    <div class="card" onclick="navigate('#recipe/${m.idMeal}')">
      <img src="${m.strMealThumb}" alt="${escapeHtml(m.strMeal)}" />
      <h3>${escapeHtml(m.strMeal)}</h3>
      <div class="meta">
        <div class="small">${escapeHtml(m.strCategory || '')}</div>
        <div class="cta">
          <button class="btn btn-ghost" onclick="event.stopPropagation(); navigate('#recipe/${m.idMeal}')">View</button>
          <button class="btn ${isFav(m.idMeal) ? 'btn-ghost' : 'btn-action'}" onclick="toggleFavCard(event, '${m.idMeal}')">${isFav(m.idMeal) ? 'Saved' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;
}
function smallCardHTML(m){ // smaller card for homepage quick picks
  return `<div class="card" onclick="navigate('#recipe/${m.idMeal}')"><img src="${m.strMealThumb}"/><h3>${escapeHtml(m.strMeal)}</h3></div>`;
}

async function toggleFavCard(ev, id){
  ev.stopPropagation();
  ev.preventDefault();
  if (isFav(id)) { removeFav(id); ev.currentTarget.className='btn btn-action'; ev.currentTarget.textContent='Save'; updateFavCount(); return; }
  try {
    const res = await fetch(`${API}/lookup.php?i=${id}`);
    const json = await res.json();
    const meal = json.meals && json.meals[0];
    if (meal) { addFav(meal); ev.currentTarget.className='btn btn-ghost'; ev.currentTarget.textContent='Saved'; updateFavCount(); }
  } catch (e) { console.error(e); }
}

// ------------------- UTILS -------------------
function escapeHtml(s){
  if (!s && s !== 0) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
