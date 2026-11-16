// Illustrative catalogue for the interface preview. Replace only with sourced,
// permissioned price observations before presenting prices as real retail data.
const products = [
  {id:'tomatoes',name:'Tomatoes',detail:'1 kg · Loose',category:'Produce',price:24.99,change:'−8% this week',emoji:'🍅',bg:'#f8eee7',unit:'R24.99 / kg'},
  {id:'milk',name:'Full cream milk',detail:'2 L · Long-life',category:'Dairy',price:32.49,change:'+2% this week',emoji:'🥛',bg:'#edf2f4',unit:'R16.25 / L'},
  {id:'rice',name:'White rice',detail:'2 kg · Long grain',category:'Pantry',price:42.99,change:'−3% this week',emoji:'🍚',bg:'#f3f0e7',unit:'R21.50 / kg'},
  {id:'eggs',name:'Large eggs',detail='6 pack · Free range',category:'Dairy',price:28.99,change:'−5% this week',emoji:'🥚',bg:'#f5f0e5',unit:'R4.83 / egg'},
  {id:'bread',name:'Brown bread',detail:'700 g · Sliced',category:'Pantry',price:18.99,change:'No change',emoji:'🍞',bg:'#f4ede3',unit:'R27.13 / kg'},
  {id:'bananas',name:'Bananas',detail:'1 kg · Loose',category:'Produce',price:21.99,change:'−1% this week',emoji:'🍌',bg:'#f6f3dc',unit:'R21.99 / kg'}
];

const grid = document.querySelector('#product-grid');
const search = document.querySelector('#product-search');
const filters = [...document.querySelectorAll('.filter')];
const basketItems = document.querySelector('#basket-items');
let activeFilter = 'all';
let sortByPrice = false;
let basket = {};
try { basket = JSON.parse(localStorage.getItem('foodpulse-basket') || '{}') || {}; } catch { basket = {}; }
const money = n => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n);

function renderProducts(){
  const term = search.value.trim().toLowerCase();
  let visible = products.filter(p => (activeFilter === 'all' || p.category === activeFilter) && `${p.name} ${p.detail} ${p.category}`.toLowerCase().includes(term));
  if(sortByPrice) visible = [...visible].sort((a,b)=>a.price-b.price);
  document.querySelector('#item-count').textContent = String(visible.length).padStart(2,'0');
  grid.innerHTML = visible.length ? visible.map(p=>`<article class="product-card">
    <div class="product-visual" style="--visual-bg:${p.bg}" aria-hidden="true">${p.emoji}<small>DEMO ITEM</small></div>
    <div class="product-info"><div class="product-category">${p.category}</div><h3>${p.name}</h3><div class="product-meta">${p.detail}</div><div class="price-row"><div><span class="price">${money(p.price)}</span><span class="unit-price">${p.unit}</span></div><span class="price-change ${p.change.startsWith('+')?'up':''}">${p.change}</span></div></div>
    <button class="add-button" data-add="${p.id}" aria-label="Add ${p.name} to basket">+</button>
  </article>`).join('') : '<div class="no-results">No products match that search. Try another name or category.</div>';
}
function renderBasket(){
  const entries = Object.entries(basket).filter(([,qty])=>qty>0);
  const count = entries.reduce((sum,[,qty])=>sum+qty,0);
  const total = entries.reduce((sum,[id,qty])=>sum+(products.find(p=>p.id===id)?.price||0)*qty,0);
  document.querySelector('#basket-count').textContent = `${count} ${count===1?'ITEM':'ITEMS'}`;
  document.querySelector('#basket-total').textContent = money(total);
  basketItems.innerHTML = entries.length ? entries.map(([id,qty])=>{const p=products.find(x=>x.id===id);return `<div class="basket-line"><span class="basket-emoji">${p.emoji}</span><span class="basket-name">${p.name}<small>${qty} × ${money(p.price)} · demo price</small></span><strong>${money(qty*p.price)}</strong><button class="remove-item" data-remove="${id}" aria-label="Remove one ${p.name}">−</button></div>`}).join('') : '<div class="basket-empty"><span>＋</span><p>Your basket is ready when you are.</p><small>Add an item from the price watch above.</small></div>';
  try { localStorage.setItem('foodpulse-basket',JSON.stringify(basket)); } catch { /* Basket still works for this page view. */ }
}
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900)}
search.addEventListener('input',renderProducts);
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>item.classList.remove('active'));button.classList.add('active');activeFilter=button.dataset.filter;renderProducts()}));
document.querySelector('#sort-button').addEventListener('click',event=>{sortByPrice=!sortByPrice;event.currentTarget.innerHTML=`Sort: ${sortByPrice?'Lowest price':'Popular'} <span>⌄</span>`;renderProducts()});
grid.addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(!button)return;const id=button.dataset.add;basket[id]=(basket[id]||0)+1;renderBasket();toast(`${products.find(p=>p.id===id).name} added to your basket`)});
basketItems.addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const id=button.dataset.remove;basket[id]--;if(basket[id]<=0)delete basket[id];renderBasket()});
document.querySelector('.mobile-menu').addEventListener('click',()=>{const nav=document.querySelector('.main-nav');const opened=nav.style.display==='flex';nav.style.display=opened?'none':'flex';nav.style.position=opened?'':'absolute';nav.style.top=opened?'':'61px';nav.style.left=opened?'':'0';nav.style.right=opened?'':'0';nav.style.height=opened?'':'auto';nav.style.marginLeft='0';nav.style.padding=opened?'':'12px 16px';nav.style.background=opened?'':'var(--paper)';nav.style.borderBottom=opened?'':'1px solid var(--line)';nav.style.flexDirection='column';nav.style.alignItems='stretch';nav.querySelectorAll('.nav-link').forEach(link=>link.style.padding='9px 0')});
renderProducts();
renderBasket();
