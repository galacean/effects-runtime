function getAssetBaseURL () {
  const query = new URLSearchParams(window.location.search);

  return query.get('assetBaseUrl') || query.get('assetBaseURL') || '';
}

function isAbsoluteURL (url: string) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

export function resolveAssetURL (url: string) {
  const baseURL = getAssetBaseURL().trim();

  if (!baseURL || isAbsoluteURL(url)) {
    return url;
  }

  const normalizedBaseURL = baseURL.replace(/\/+$/, '');
  const normalizedURL = url.replace(/^\/+/, '');

  return `${normalizedBaseURL}/${normalizedURL}`;
}
