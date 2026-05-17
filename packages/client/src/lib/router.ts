import {
  useLocation,
  useNavigate,
  useSearchParams as useReactRouterSearchParams,
} from "react-router-dom";

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const [params] = useReactRouterSearchParams();
  return params;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => window.history.back(),
  };
}
