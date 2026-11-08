const savedTheme = localStorage.getItem('wishlist_theme');
const systemThemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
const prefersDark = systemThemeQuery?.matches ?? false;
document.documentElement.classList.toggle('dark', savedTheme === 'dark' || (savedTheme !== 'light' && prefersDark));

tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0f3ff',
                    100: '#e0e7ff',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                }
            }
        }
    }
}

const INITIAL_ITEMS = [
    {
        id: "1",
        title: "Bambu Lab X1-Carbon 3D Printer",
        url: "https://bambulab.com",
        imageUrl: "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=600&q=80",
        price: "1449.00",
        purchased: false,
        buyerName: null,
        purchaseDate: null
    },
    {
        id: "2",
        title: "Ergonomic Desk Chair",
        url: "",
        imageUrl: "https://images.unsplash.com/photo-1580481072645-022f9a6d1270?auto=format&fit=crop&w=600&q=80",
        price: "249.99",
        purchased: false,
        buyerName: null,
        purchaseDate: null
    },
    {
        id: "3",
        title: "Bambu Dual-Sided Textured PEI Plate",
        url: "https://store.bambulab.com",
        imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        price: "34.99",
        purchased: false,
        buyerName: null,
        purchaseDate: null
    },
    {
        id: "4",
        title: "SUNLU Filament Dryer S2",
        url: "https://www.amazon.com",
        imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80",
        price: "49.99",
        purchased: false,
        buyerName: null,
        purchaseDate: null
    },
    {
        id: "5",
        title: "Hardened Steel Nozzle Set (0.4mm & 0.6mm)",
        url: "https://store.bambulab.com",
        imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
        price: "29.99",
        purchased: false,
        buyerName: null,
        purchaseDate: null
    }
];

const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycby4fH0fVnDzw3nSPBMBH21mk_fas_7HibtV6veVFu51yBLa_PyDu_1BdAkpoyNLG3MA/exec";

const HOME_ASSISTANT_WEBHOOK_URL = 'https://castellano.one/api/webhook/-3PLQnRyxsj1xPHJKX7XL1RmD';
const HOME_ASSISTANT_NOTIFICATION_STATE_KEY = 'home_assistant_empty_notified_public';

let items = [];
let itemsLoaded = false;
let sheetWebAppUrl = localStorage.getItem('sheet_webapp_url') || DEFAULT_SHEET_URL;

function updateThemeToggle() {
    const selectedTheme = localStorage.getItem('wishlist_theme') || 'system';
    document.querySelectorAll('#themeToggle [data-theme-choice]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === selectedTheme));
    });
}

function setTheme(theme) {
    const prefersDark = systemThemeQuery?.matches ?? false;
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
    localStorage.setItem('wishlist_theme', theme);
    updateThemeToggle();
}

systemThemeQuery?.addEventListener?.('change', (event) => {
    const selectedTheme = localStorage.getItem('wishlist_theme');
    if (selectedTheme !== null && selectedTheme !== 'system') return;
    document.documentElement.classList.toggle('dark', event.matches);
    updateThemeToggle();
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function notifyHomeAssistantIfEmpty() {
    if (!itemsLoaded) return;
    if (items.some(item => !item.purchased)) {
        localStorage.removeItem(HOME_ASSISTANT_NOTIFICATION_STATE_KEY);
        return;
    }

    const notificationState = localStorage.getItem(HOME_ASSISTANT_NOTIFICATION_STATE_KEY);
    if (!HOME_ASSISTANT_WEBHOOK_URL || notificationState === 'pending' || notificationState === 'sent') return;

    localStorage.setItem(HOME_ASSISTANT_NOTIFICATION_STATE_KEY, 'pending');
    try {
        let iframe = document.getElementById('home_assistant_webhook_iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'home_assistant_webhook_iframe';
            iframe.name = 'home_assistant_webhook_iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = HOME_ASSISTANT_WEBHOOK_URL;
        form.target = iframe.name;
        form.style.display = 'none';
        document.body.appendChild(form);
        form.submit();
        form.remove();
        localStorage.setItem(HOME_ASSISTANT_NOTIFICATION_STATE_KEY, 'sent');
    } catch (err) {
        localStorage.removeItem(HOME_ASSISTANT_NOTIFICATION_STATE_KEY);
        console.warn('Home Assistant webhook submission failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateThemeToggle();
    document.querySelectorAll('#themeToggle [data-theme-choice]').forEach((button) => {
        button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
    });
    document.querySelectorAll('[data-close-claim-modal]').forEach((button) => {
        button.addEventListener('click', closeClaimModal);
    });
    document.getElementById('claimForm').addEventListener('submit', handleClaimSubmit);
    loadItems();
    document.getElementById('purchaseDate').valueAsDate = new Date();

    window.addEventListener('storage', (e) => {
        if (e.key === 'wishlist_items') {
            const saved = localStorage.getItem('wishlist_items');
            if (saved) {
                items = JSON.parse(saved);
                itemsLoaded = true;
                renderGrid();
                notifyHomeAssistantIfEmpty();
            }
        }
    });

    setInterval(() => {
        loadItems();
    }, 10000);
});

async function loadItems() {
    if (sheetWebAppUrl) {
        try {
            const url = sheetWebAppUrl + (sheetWebAppUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
            const res = await fetch(url, { redirect: "follow" });
            if (res.ok) {
                const fetchedData = await res.json();
                if (Array.isArray(fetchedData)) {
                    itemsLoaded = true;
                    // Column Mapping: ID=row[0], Title=row[1], URL=row[2], ImageURL=row[3], Price=row[4], Purchased=row[5], BuyerName=row[6], PurchaseDate=row[7]
                    const newItems = fetchedData.map((item, idx) => ({
                        id: String(idx + 1),
                        title: item.title || "Untitled Item",
                        url: item.url || "",
                        imageUrl: item.imageUrl || "",
                        price: item.price ? String(item.price) : "",
                        purchased: (item.purchased === true || String(item.purchased).toLowerCase() === 'true' || item.purchased === 1),
                        buyerName: item.buyerName || null,
                        purchaseDate: item.purchaseDate || null
                    }));

                    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
                        items = newItems;
                        localStorage.setItem('wishlist_items', JSON.stringify(items));
                        renderGrid();
                    }
                    notifyHomeAssistantIfEmpty();
                    return;
                }
            }
        } catch (err) {
            console.warn('Google Sheets load warning, relying on local storage:', err);
        }
    }
    const saved = localStorage.getItem('wishlist_items');
    itemsLoaded = true;
    const fallbackItems = saved ? JSON.parse(saved) : [...INITIAL_ITEMS];
    const newItems = fallbackItems.map((item, idx) => ({ ...item, id: String(idx + 1) }));
    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
        items = newItems;
        renderGrid();
    }
    notifyHomeAssistantIfEmpty();
}

function saveItems() {
    itemsLoaded = true;
    items = items.map((item, idx) => ({ ...item, id: String(idx + 1) }));
    localStorage.setItem('wishlist_items', JSON.stringify(items));
    renderGrid();
    notifyHomeAssistantIfEmpty();

    if (sheetWebAppUrl) {
        try {
            let form = document.getElementById('hidden_gsheet_form');
            if (form) form.remove();
            
            form = document.createElement('form');
            form.id = 'hidden_gsheet_form';
            form.method = 'POST';
            form.action = sheetWebAppUrl;
            form.target = 'hidden_gsheet_iframe';
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'data';
            input.value = JSON.stringify(items);
            form.appendChild(input);

            document.body.appendChild(form);
            form.submit();
        } catch (e) {
            console.warn('Form submission to Google Sheets failed:', e);
        }
    }
}

function renderGrid() {
    const grid = document.getElementById('wishlistGrid');
    grid.innerHTML = '';

    const itemsToDisplay = items.filter(i => !i.purchased);

    if (itemsToDisplay.length === 0) {
        const card = document.createElement('div');
        card.className = "col-span-full bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 rounded-3xl p-8 md:p-12 text-center shadow-xl space-y-6 max-w-2xl mx-auto";

        card.innerHTML = `
            <div class="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center mx-auto text-3xl shadow-lg shadow-indigo-500/30">
                <i class="fa-solid fa-gift"></i>
            </div>
            <div class="space-y-3">
                <h4 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">All current gifts are reserved! 🎉</h4>
                <p class="text-base md:text-lg font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
                    Thank you so much to everyone who claimed a gift! You can wait for new items to show up, or feel free to check back later.
                </p>
            </div>
            <a href="https://store.bambulab.com/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-500">
                <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                Visit Bambu Lab Store
            </a>
        `;
        grid.appendChild(card);
        return;
    }

    itemsToDisplay.forEach(item => {
        const card = document.createElement('div');
        card.className = "group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-md hover:shadow-2xl shadow-slate-200/50 dark:shadow-none card-hover transition-all duration-300";

        const imgContainer = document.createElement('div');
        imgContainer.className = "relative h-52 bg-slate-100 dark:bg-slate-950 overflow-hidden";

        const imgSrc = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : '';
        const formattedPrice = item.price ? (String(item.price).startsWith('$') ? item.price : `$${item.price}`) : '';

        let imgHtml = `
            ${imgSrc
                ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
                : '<div class="item-image-placeholder w-full h-full flex flex-col items-center justify-center gap-3" role="img" aria-label="No image available"><i class="fa-regular fa-image text-4xl" aria-hidden="true"></i><span class="text-xs font-medium tracking-wide">No image available</span></div>'}
            ${formattedPrice ? `
                <div class="wishlist-price-badge absolute bottom-3 left-3 backdrop-blur-md border px-2.5 py-1 rounded-lg text-xs font-bold shadow-md">
                    ${escapeHtml(formattedPrice)}
                </div>
            ` : ''}
        `;

        if (item.url && item.url.trim() !== '') {
            imgHtml = `
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="block w-full h-full" title="View product link">
                    ${imgHtml}
                </a>
            `;
        }

        imgContainer.innerHTML = imgHtml;
        const image = imgContainer.querySelector('img');
        if (image) {
            image.addEventListener('error', () => showImagePlaceholder(image), { once: true });
        }

        const body = document.createElement('div');
        body.className = "p-5 flex-grow flex flex-col justify-between space-y-4";

        const contentSection = document.createElement('div');
        contentSection.className = "space-y-3";

        const titleElem = document.createElement('h3');
        titleElem.className = "font-bold text-lg leading-snug text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors";
        titleElem.textContent = item.title;
        contentSection.appendChild(titleElem);

        if (item.url && item.url.trim() !== '') {
            const linkBtn = document.createElement('a');
            linkBtn.href = item.url;
            linkBtn.target = '_blank';
            linkBtn.rel = 'noopener noreferrer';
            linkBtn.className = 'wishlist-item-link w-full py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs flex items-center justify-center gap-2 transition-colors';
            linkBtn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square text-xs"></i> View Item Online`;
            contentSection.appendChild(linkBtn);
        }

        const actionsSection = document.createElement('div');
        actionsSection.className = "pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80";

        const claimBtn = document.createElement('button');
        claimBtn.onclick = () => openClaimModal(item.id, item.title);
        claimBtn.className = "wishlist-claim-button w-full py-3 px-4 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98]";
        claimBtn.innerHTML = `<i class="fa-solid fa-gift text-sm"></i> I'll Get This Gift!`;
        actionsSection.appendChild(claimBtn);

        body.appendChild(contentSection);
        body.appendChild(actionsSection);

        card.appendChild(imgContainer);
        card.appendChild(body);

        grid.appendChild(card);
    });
}

function showImagePlaceholder(image) {
    const placeholder = document.createElement('div');
    placeholder.className = 'item-image-placeholder w-full h-full flex flex-col items-center justify-center gap-3';
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'No image available');
    placeholder.innerHTML = '<i class="fa-regular fa-image text-4xl" aria-hidden="true"></i><span class="text-xs font-medium tracking-wide">No image available</span>';
    image.replaceWith(placeholder);
}

function openClaimModal(id, title) {
    document.getElementById('claimItemId').value = id;
    document.getElementById('claimModalTitle').textContent = `Purchasing: ${title}`;
    document.getElementById('claimModal').classList.remove('hidden');
}

function closeClaimModal() {
    document.getElementById('claimModal').classList.add('hidden');
}

function handleClaimSubmit(event) {
    event.preventDefault();
    const itemId = document.getElementById('claimItemId').value;
    const buyerName = document.getElementById('buyerName').value.trim();
    const purchaseDate = document.getElementById('purchaseDate').value;

    const target = items.find(i => i.id === itemId);
    if (target) {
        target.purchased = true;
        target.buyerName = buyerName;
        target.purchaseDate = purchaseDate;
    }
    saveItems();
    closeClaimModal();
    showToast("Thank you! Item marked as purchased.");
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toastMsg.textContent = message;

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
