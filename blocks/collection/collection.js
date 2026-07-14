import { readBlockConfig } from '../../scripts/aem.js';
import { CS_FETCH_GRAPHQL, getProductLink } from '../../scripts/commerce.js';

const PRODUCTS_QUERY = `
  query COLLECTION_PRODUCTS($skus: [String!]!) {
    products(skus: $skus) {
      __typename
      sku
      name
      urlKey
      inStock
      images(roles: ["thumbnail"]) {
        url
        label
      }
      ... on SimpleProductView {
        price { final { amount { value currency } } }
      }
      ... on ComplexProductView {
        priceRange { minimum { final { amount { value currency } } } }
      }
    }
  }
`;

/**
 * Parses a comma/newline separated list of SKUs into a clean array.
 * @param {string} value Raw authored value
 * @returns {string[]}
 */
function parseSkus(value) {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((sku) => sku.trim())
    .filter(Boolean);
}

/**
 * Formats a price amount using the product's currency.
 * @param {{value:number, currency:string}} amount
 * @returns {string}
 */
function formatPrice(amount) {
  if (!amount || typeof amount.value !== 'number') return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: amount.currency || 'USD',
    }).format(amount.value);
  } catch (e) {
    return `${amount.value} ${amount.currency || ''}`.trim();
  }
}

/**
 * Extracts the display price from either product type.
 * @param {object} product
 * @returns {string}
 */
function getPrice(product) {
  const amount = product.price?.final?.amount
    || product.priceRange?.minimum?.final?.amount;
  return formatPrice(amount);
}

/**
 * Builds a single product card element.
 * @param {object} product
 * @returns {HTMLElement}
 */
function renderCard(product) {
  const link = getProductLink(product.urlKey, product.sku);
  const image = product.images?.[0];
  const imageUrl = image?.url ? image.url.replace(/^https?:/, '') : '';
  const price = getPrice(product);

  const card = document.createElement('a');
  card.className = 'collection__card';
  card.href = link;

  card.innerHTML = `
    <div class="collection__card-image">
      ${imageUrl ? `<img src="${imageUrl}" alt="${image.label || product.name}" loading="lazy" width="300" height="375">` : ''}
    </div>
    <div class="collection__card-info">
      <span class="collection__card-name">${product.name}</span>
      ${price ? `<span class="collection__card-price">${price}</span>` : ''}
    </div>
  `;
  return card;
}

/**
 * Reads the requested page from the URL (1-based).
 * @returns {number}
 */
function getCurrentPage() {
  const page = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
  return Number.isNaN(page) || page < 1 ? 1 : page;
}

/**
 * Builds the pagination control.
 * @param {number} current Current page (1-based)
 * @param {number} totalPages
 * @param {(page:number)=>void} onChange
 * @returns {HTMLElement}
 */
function renderPagination(current, totalPages, onChange) {
  const nav = document.createElement('nav');
  nav.className = 'collection__pagination';
  nav.setAttribute('aria-label', 'Pagination');

  const makeButton = (label, page, { disabled = false, active = false } = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collection__page';
    button.textContent = label;
    if (active) {
      button.classList.add('collection__page--active');
      button.setAttribute('aria-current', 'page');
    }
    if (disabled) {
      button.disabled = true;
    } else {
      button.addEventListener('click', () => onChange(page));
    }
    return button;
  };

  nav.appendChild(makeButton('‹', current - 1, { disabled: current <= 1 }));
  for (let page = 1; page <= totalPages; page += 1) {
    nav.appendChild(makeButton(`${page}`, page, { active: page === current }));
  }
  nav.appendChild(makeButton('›', current + 1, { disabled: current >= totalPages }));
  return nav;
}

/**
 * loads and decorates the collection block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const title = config.title || 'Browse the collection';
  const pageSize = parseInt(config.pagesize, 10) || 12;
  const skus = parseSkus(config.skus);

  block.innerHTML = `
    <div class="collection__header">
      <h2 class="collection__title">${title}</h2>
      <p class="collection__count"></p>
    </div>
    <div class="collection__grid" aria-live="polite"></div>
    <div class="collection__pagination-wrapper"></div>
  `;

  const $grid = block.querySelector('.collection__grid');
  const $count = block.querySelector('.collection__count');
  const $paginationWrapper = block.querySelector('.collection__pagination-wrapper');

  if (!skus.length) {
    block.classList.add('collection--empty');
    $count.textContent = 'No products configured for this collection.';
    return;
  }

  let products = [];
  try {
    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(PRODUCTS_QUERY, {
      variables: { skus },
    });
    // Preserve the authored SKU order and drop any that didn't resolve.
    const bySku = new Map((data?.products || []).map((p) => [p.sku, p]));
    products = skus.map((sku) => bySku.get(sku)).filter(Boolean);
  } catch (e) {
    block.classList.add('collection--empty');
    $count.textContent = 'Unable to load products right now.';
    return;
  }

  if (!products.length) {
    block.classList.add('collection--empty');
    $count.textContent = 'No products found.';
    return;
  }

  const totalPages = Math.ceil(products.length / pageSize);

  const renderPage = (page) => {
    const current = Math.min(Math.max(page, 1), totalPages);
    const start = (current - 1) * pageSize;
    const pageItems = products.slice(start, start + pageSize);

    $grid.innerHTML = '';
    pageItems.forEach((product) => $grid.appendChild(renderCard(product)));

    $count.textContent = `${products.length} products`;

    $paginationWrapper.innerHTML = '';
    if (totalPages > 1) {
      $paginationWrapper.appendChild(renderPagination(current, totalPages, (next) => {
        const url = new URL(window.location.href);
        url.searchParams.set('page', next);
        window.history.pushState({}, '', url.toString());
        renderPage(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
    }
  };

  renderPage(getCurrentPage());

  // Keep the grid in sync with browser back/forward navigation.
  window.addEventListener('popstate', () => renderPage(getCurrentPage()));
}
