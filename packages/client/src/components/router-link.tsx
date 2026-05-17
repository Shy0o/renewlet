import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  type LinkProps as RouterLinkProps,
  type NavLinkProps as RouterNavLinkProps,
} from "react-router-dom";

type LinkProps = Omit<RouterLinkProps, "to"> & {
  href?: RouterLinkProps["to"];
  to?: RouterLinkProps["to"];
};

type NavLinkProps = Omit<RouterNavLinkProps, "to"> & {
  href?: RouterNavLinkProps["to"];
  to?: RouterNavLinkProps["to"];
};

export function Link({ href, to, ...props }: LinkProps) {
  return <RouterLink to={to ?? href ?? "/"} {...props} />;
}

export function NavLink({ href, to, ...props }: NavLinkProps) {
  return <RouterNavLink to={to ?? href ?? "/"} {...props} />;
}

export default Link;
