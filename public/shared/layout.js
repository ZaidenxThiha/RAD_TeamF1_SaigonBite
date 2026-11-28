// Shared workspace sidebar/header. Author: Thin Lei Sandi (523K0075).
// Each use case supplies its own working navigation links and actor context.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const paths = {
  bowl: 'M3 10h18c-1 6-4 9-9 9S4 16 3 10Z M7 5h10 M6 22h12',
  orders: 'M5 3h14v18H5Z M8 8h8 M8 12h8 M8 16h5',
  vouchers: 'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z M12 8v10',
  sidebar: 'M4 3h16v18H4Z M9 3v18',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name] || paths.orders);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

export function renderWorkspaceLayout({ workspace, home, breadcrumb, description, role, initials, navigation }) {
  const sidebar = document.querySelector('[data-sidebar]');
  const header = document.querySelector('[data-header]');
  if (!sidebar || !header) throw new Error('Workspace layout requires sidebar and header hosts.');

  const brand = element('a', undefined, 'brand');
  brand.href = home;
  const logo = element('span', undefined, 'logo');
  logo.append(icon('bowl'));
  const name = element('span', 'SaigonBite');
  name.append(element('small', workspace.toUpperCase()));
  brand.append(logo, name);

  const nav = element('nav');
  nav.setAttribute('aria-label', workspace);
  for (const item of navigation) {
    const link = element('a');
    link.href = item.href;
    link.append(icon(item.icon), element('span', item.label));
    if (item.active) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  function avatar() {
    const node = element('span', initials, 'avatar');
    node.setAttribute('aria-hidden', 'true');
    return node;
  }
  const account = element('small', 'Demo workspace');
  const profileText = element('span', role);
  profileText.append(account);
  const profile = element('div', undefined, 'profile');
  profile.append(avatar(), profileText);
  sidebar.replaceChildren(brand, element('div', 'WORKSPACE', 'nav-label'), nav, profile);

  const title = element('div', breadcrumb);
  title.append(element('small', description));
  sidebar.id = sidebar.id || 'workspace-sidebar';
  const toggle = element('button', undefined, 'sidebar-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.append(icon('sidebar'));
  function setSidebar(open) {
    sidebar.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close sidebar' : 'Open sidebar');
    toggle.title = open ? 'Close sidebar' : 'Open sidebar';
  }
  setSidebar(true);
  toggle.onclick = () => setSidebar(sidebar.hidden);
  sidebar.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setSidebar(false);
      toggle.focus();
    }
  });
  const start = element('div', undefined, 'header-start');
  start.append(toggle, title);
  const context = element('small', 'Loading assigned hub…');
  const identityText = element('span', role);
  identityText.append(context);
  const identity = element('div', undefined, 'identity');
  identity.append(avatar(), identityText);
  header.replaceChildren(start, identity);

  return {
    updateIdentity({ accountLabel, contextLabel }) {
      account.textContent = accountLabel;
      context.textContent = contextLabel;
    },
  };
}
