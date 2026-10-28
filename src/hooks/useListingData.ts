import { useState, useEffect } from 'react';

export function useListingData(listingId: string | null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!listingId) return;
    
    setLoading(true);
    fetch(`/api/listings/${listingId}`)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [listingId]);

  return { data, loading, error };
}
