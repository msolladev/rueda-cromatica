import { useCallback, useEffect, useState } from "react";
import {
  fetchCatalog,
  loadCatalog,
  type CatalogLoad,
  type ReadCatalog,
} from "./load.ts";

/**
 * Loads the catalog once, in the browser only, and lets the user retry after
 * a network error.
 */
export function useCatalog(read: ReadCatalog = fetchCatalog): {
  readonly load: CatalogLoad;
  readonly retry: () => void;
} {
  const [load, setLoad] = useState<CatalogLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void loadCatalog(read).then((result) => {
      if (current) setLoad(result);
    });
    return () => {
      current = false;
    };
  }, [read, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { load, retry };
}
