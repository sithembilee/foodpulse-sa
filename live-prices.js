const liveForm = document.querySelector('#live-search-form');
const liveInput = document.querySelector('#live-query');
const liveButton = document.querySelector('#live-search-button');
const liveStatus = document.querySelector('#live-status');
const liveResults = document.querySelector('#live-results');

function setLiveStatus(message, kind = '') {
  liveStatus.textContent = message;
  liveStatus.className = `live-status ${kind}`.trim();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function displayPrice(offer) {
  if (typeof offer.priceFormatted === 'string' && offer.priceFormatted) return offer.priceFormatted;
  const amount = Number(offer.price);
  return Number.isFinite(amount) && amount >= 0
    ? new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR'}).format(amount)
    : 'Price unavailable';
}

function displayTime(value) {
  if (!value) return 'Fetch time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fetch time unavailable' : `Fetched ${date.toLocaleString('en-ZA')}`;
}

function renderLiveResults(data) {
  liveResults.replaceChildren();
  const matches = Array.isArray(data.matches) ? data.matches : [];
  if (!matches.length) {
    setLiveStatus('No like-for-like matches were returned. Try including the brand and pack size.', 'notice');
    return;
  }

  setLiveStatus(`Live comparison for “${data.query || liveInput.value.trim()}” · ${matches.length} matched product${matches.length === 1 ? '' : 's'}.`, 'success');
  const fragment = document.createDocumentFragment();
  for (const match of matches) {
    const card = element('article', 'live-match-card');
    const header = element('div', 'live-match-header');
    const titleGroup = element('div', '');
    titleGroup.append(element('h3', 'live-product-name', match.name || 'Matched product'));
    if (match.size) titleGroup.append(element('span', 'live-product-size', match.size));
    header.append(titleGroup);
    if (Number.isFinite(Number(match.saving)) && Number(match.saving) > 0) {
      header.append(element('span', 'live-saving', `Save ${new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(match.saving))}`));
    }
    card.append(header);

    const offers = Array.isArray(match.offers) ? match.offers : [];
    const cheapestStores = Array.isArray(match.cheapestStores) ? match.cheapestStores : [];
    const offerList = element('div', 'live-offers');
    for (const offer of offers) {
      const row = element('div', 'live-offer');
      if (cheapestStores.includes(offer.store)) row.classList.add('cheapest-offer');
      const detail = element('div', 'live-offer-detail');
      detail.append(element('strong', 'live-store-name', offer.storeName || offer.store || 'Retailer'));
      detail.append(element('span', 'live-offer-name', offer.name || match.name || 'Product'));
      const stockState = offer.stockState === 'unknown'
        ? 'Stock unknown'
        : offer.inStock === true ? 'In stock' : offer.inStock === false ? 'Out of stock' : 'Stock not confirmed';
      detail.append(element('span', `live-stock ${offer.inStock === true ? 'in-stock' : ''}`, stockState));
      if (Array.isArray(offer.promotions) && offer.promotions.length) {
        detail.append(element('span', 'live-promotion', offer.promotions.join(' · ')));
      }
      if (offer.memberPrice !== undefined && offer.memberPrice !== null) {
        detail.append(element('span', 'live-promotion', `Member price: ${displayPrice({...offer, price:offer.memberPrice, priceFormatted:null})}`));
      }
      detail.append(element('span', 'live-fetched-at', displayTime(offer.fetchedAt)));

      const priceGroup = element('div', 'live-price-group');
      priceGroup.append(element('strong', 'live-price', displayPrice(offer)));
      if (cheapestStores.includes(offer.store)) priceGroup.append(element('span', 'cheapest-label', 'Lowest · in stock'));
      else if (Array.isArray(match.lowestPriceStores) && match.lowestPriceStores.includes(offer.store)) priceGroup.append(element('span', 'cheapest-label', 'Lowest · stock unknown'));

      const rowContent = element('div', 'live-offer-content');
      rowContent.append(detail, priceGroup);
      if (typeof offer.url === 'string') {
        try {
          const url = new URL(offer.url);
          if (url.protocol === 'https:') {
            const link = element('a', 'retailer-link', 'View retailer product ↗');
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            detail.append(link);
          }
        } catch { /* Ignore malformed provider links. */ }
      }
      row.append(rowContent);
      offerList.append(row);
    }
    if (!offers.length) offerList.append(element('p', 'live-empty-offers', 'No retailer offers were returned for this match.'));
    card.append(offerList);
    fragment.append(card);
  }
  liveResults.append(fragment);
}

liveForm.addEventListener('submit', async event => {
  event.preventDefault();
  const query = liveInput.value.trim();
  if (!query) {
    setLiveStatus('Enter a product name to search.', 'error');
    return;
  }

  liveButton.disabled = true;
  liveResults.replaceChildren();
  setLiveStatus('Checking live retailer catalogues…', 'loading');
  try {
    const response = await fetch(`/api/grocery/compare?q=${encodeURIComponent(query)}&limit=5`, {headers:{Accept:'application/json'}});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Price lookup failed (${response.status}).`);
    renderLiveResults(data);
  } catch (error) {
    setLiveStatus(error.message || 'Price lookup failed. Check the server and try again.', 'error');
  } finally {
    liveButton.disabled = false;
  }
});

fetch('/api/health')
  .then(response => response.json())
  .then(data => {
    if (data.configured) setLiveStatus('AZ Labs is ready. Search to fetch current retailer prices.', 'ready');
    else setLiveStatus('Live search needs an AZ Labs API key configured on the server.', 'notice');
  })
  .catch(() => setLiveStatus('Start FoodPulse with py server.py to enable live price searches.', 'notice'));
