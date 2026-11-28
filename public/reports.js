import { renderWorkspaceLayout } from '/shared/layout.js';

const navigation = [
  { label: 'Overview', icon: 'overview', href: '/reports' },
  { label: 'Orders', icon: 'orders', href: '/kitchen' },
  { label: 'Hubs & Menus', icon: 'hubs', href: '/' },
  { label: 'Reports', icon: 'reports', href: '/reports', active: true },
  { label: 'Settings', icon: 'settings', href: '#' },
];
renderWorkspaceLayout({
  workspace: 'Manager workspace', home: '/reports', breadcrumb: 'Workspace  /  Reports',
  description: 'SaigonBite reporting centre', role: 'Manager', initials: 'MG', navigation,
}).updateIdentity({ accountLabel: 'Reporting workspace', contextLabel: 'Workspace manager' });

function icon(name) {
  const image = document.createElement('img');
  image.src = '/prototype/' + name + '.svg';
  image.alt = '';
  return image;
}

document.querySelector('.sidebar .logo').replaceChildren(icon('report-mark'));
const reportLinks = document.querySelectorAll('.sidebar nav a');
reportLinks.forEach((link, index) => {
  link.firstElementChild.replaceWith(icon(navigation[index].icon));
  if (navigation[index].href === '#') {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  }
});
const notice = document.createElement('span');
notice.className = 'workspace-notice';
notice.append(icon('bell'));
document.querySelector('.header .identity').prepend(notice);

const criteria = document.querySelector('#report-criteria');
if (criteria) {
  const selectedText = name => criteria.elements[name].selectedOptions[0]?.textContent;
  const updateSummary = () => {
    const type = criteria.elements.type.value;
    const summary = {
      sales: 'Confirmed sales, order volume, average order value and hub performance.',
      workload: 'Submitted, confirmed and rejected orders grouped by hub.',
      delivery: 'Completed and failed delivery outcomes grouped by hub.',
    };
    document.querySelector('#summary-type').textContent = selectedText('type');
    const highlights = {
      sales: ['Confirmed sales and order volume', 'Average order value', 'Hub-level sales breakdown'],
      workload: ['Order volumes by hub', 'Submitted, confirmed and rejected counts'],
      delivery: ['Completed and failed deliveries', 'Delivery outcomes by hub'],
    };
    const list = document.querySelector('#summary-highlights');
    if (list) {
      document.querySelector('#summary-description').textContent = summary[type] || '';
      list.replaceChildren(...(highlights[type] || []).map(text => {
        const line = document.createElement('li');
        line.textContent = text;
        return line;
      }));
    }
    document.querySelector('#summary-period').textContent =
      criteria.elements.from.value + ' — ' + criteria.elements.to.value;
  };
  criteria.addEventListener('input', updateSummary);
  updateSummary();
}
