import { useState, useEffect } from 'react';

export function useListingPhotos(listingId: string | null) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!listingId) return;
    
    setLoading(true);
    fetch(`/api/listings/${listingId}/photos`)
      .then(res => res.json())
      .then(data => setPhotos(data.photos || []))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [listingId]);

  return { photos, loading, error };
}
