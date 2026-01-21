import { initializers } from '@dropins/tools/initializer.js';
import { Image, provider as UI } from '@dropins/tools/components.js';
import { initialize, setEndpoint, fetchGraphQl } from '@dropins/storefront-pdp/api.js';
import { PRODUCT_FRAGMENT } from '@dropins/storefront-pdp/fragments.js';
import { isAemAssetsEnabled, tryGenerateAemAssetsOptimizedUrl } from '@dropins/tools/lib/aem/assets.js';
import { initializeDropin } from './index.js';
import {
  CS_FETCH_GRAPHQL,
  fetchPlaceholders,
  getOptionsUIDsFromUrl,
  getProductSku,
  loadErrorPage,
  preloadFile,
} from '../commerce.js';
import { getMetadata } from '../aem.js';

/**
 * Custom GraphQL query that extends PRODUCT_FRAGMENT with videos field
 */
/**
 * Converts a Vimeo URL to an embeddable player URL
 * @param {string} url - Original Vimeo URL (e.g., https://vimeo.com/1156860195?share=copy)
 * @returns {string} Embed URL (e.g., https://player.vimeo.com/video/1156860195)
 */
function toVimeoEmbedUrl(url) {
  try {
    const urlObj = new URL(url);
    // Extract video ID from path (e.g., /1156860195)
    const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
    if (videoId && /^\d+$/.test(videoId)) {
      return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch (e) {
    console.warn('Failed to parse Vimeo URL:', url, e);
  }
  return url;
}

const PRODUCT_QUERY_WITH_VIDEOS = `
  query GET_PRODUCT_DATA($skus: [String]) {
    products(skus: $skus) {
      ...PRODUCT_FRAGMENT
      videos {
        url
        title
        preview {
          label
          roles
          url
        }
      }
    }
  }
  ${PRODUCT_FRAGMENT}
`;

/**
 * Fetches product data with videos using custom query
 * @param {string} sku - Product SKU
 * @param {Object} options - Options including optionsUIDs
 * @returns {Promise<Object|null>} Product data with videos or null
 */
async function fetchProductDataWithVideos(sku, options = {}) {
  const { data } = await fetchGraphQl(PRODUCT_QUERY_WITH_VIDEOS, {
    method: 'GET',
    variables: { skus: [sku] },
  });

  const product = data?.products?.[0];
  if (!product) return null;

  // Add optionsUIDs if provided
  if (options.optionsUIDs) {
    product.optionUIDs = options.optionsUIDs;
  }

  return product;
}

export const IMAGES_SIZES = {
  width: 960,
  height: 1191,
};

/**
 * Extracts the main product image URL from JSON-LD or meta tags
 * @returns {string|null} The image URL or null if not found
 */
function extractMainImageUrl() {
  // Cache DOM query to avoid repeated lookups
  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

  if (!jsonLdScript?.textContent) {
    return getMetadata('og:image') || getMetadata('image');
  }

  try {
    const jsonLd = JSON.parse(jsonLdScript.textContent);

    // Verify this is product structured data before extracting image
    if (jsonLd?.['@type'] === 'Product' && jsonLd?.image) {
      return jsonLd.image;
    }

    return getMetadata('og:image') || getMetadata('image');
  } catch (error) {
    console.debug('Failed to parse JSON-LD:', error);
    return getMetadata('og:image') || getMetadata('image');
  }
}

/**
 * Preloads PDP Dropins assets for optimal performance
 */
function preloadPDPAssets() {
  // Preload PDP Dropins assets
  preloadFile('/scripts/__dropins__/storefront-pdp/api.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/render.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductHeader.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductPrice.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductShortDescription.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductOptions.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductQuantity.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductDescription.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductAttributes.js', 'script');
  preloadFile('/scripts/__dropins__/storefront-pdp/containers/ProductGallery.js', 'script');

  // Extract and preload main product image
  const imageUrl = extractMainImageUrl();

  if (imageUrl) {
    preloadFile(imageUrl, 'image');
  } else {
    console.warn('Unable to infer main image from JSON-LD or meta tags');
  }
}

await initializeDropin(async () => {
  // Inherit Fetch GraphQL Instance (Catalog Service)
  setEndpoint(CS_FETCH_GRAPHQL);

  // Preload PDP assets immediately when this module is imported
  preloadPDPAssets();

  // Fetch product data
  const sku = getProductSku();
  const optionsUIDs = getOptionsUIDsFromUrl();

  const [product, labels] = await Promise.all([
    fetchProductDataWithVideos(sku, { optionsUIDs }).then(preloadImageMiddleware),
    fetchPlaceholders('placeholders/pdp.json'),
  ]);

  console.log('product', product);

  if (!product?.sku) {
    return loadErrorPage();
  }

  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  const models = {
    ProductDetails: {
      initialData: { ...product },
      transformer: (rawData) => {
        console.log('rawData', rawData);

        if (!rawData?.videos?.length) {
          return rawData; // Pass through unchanged
        }

        // Convert videos to gallery-compatible format with embed URLs
        const videoAsImages = rawData.videos.map((v) => ({
          url: toVimeoEmbedUrl(v.url),
          label: v.title || 'Product Video',
          width: 640,
          height: 360,
          isVideo: true, // Custom flag to detect in gallery slot
        }));

        return {
          ...rawData,
          videos: rawData.videos.map((v) => ({
            url: toVimeoEmbedUrl(v.url),
            title: v.title,
            preview: v.preview ? { url: v.preview.url } : null,
          })),
          images: [...videoAsImages,...(rawData.images || [])],
        };
      },
    },
  };

  // Initialize Dropins
  return initializers.mountImmediately(initialize, {
    sku,
    optionsUIDs,
    langDefinitions,
    models,
    acdl: true,
    persistURLParams: true,
  });
})();

async function preloadImageMiddleware(data) {
  const image = data?.images?.[0]?.url?.replace(/^https?:/, '');

  if (image) {
    let url = image;
    let imageParams = {
      ...IMAGES_SIZES,
    };
    if (isAemAssetsEnabled) {
      url = tryGenerateAemAssetsOptimizedUrl(image, data.sku, {});
      imageParams = {
        ...imageParams,
        crop: undefined,
        fit: undefined,
        auto: undefined,
      };
    }
    await UI.render(Image, {
      src: url,
      ...IMAGES_SIZES.mobile,
      params: imageParams,
      loading: 'eager',
    })(document.createElement('div'));
  }
  return data;
}
