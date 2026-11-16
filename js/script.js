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
};

const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycby4fH0fVnDzw3nSPBMBH21mk_fas_7HibtV6veVFu51yBLa_PyDu_1BdAkpoyNLG3MA/exec";
const HOME_ASSISTANT_WEBHOOK_URL = 'https://castellano.one/api/webhook/-3PLQnRyxsj1xPHJKX7XL1RmD';
const HOME_ASSISTANT_NOTIFICATION_STATE_KEY = 'home_assistant_empty_notified_public';

let items = [];
let itemsLoaded = false;
let lastSaveTimestamp = 0;
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

function extractStoreName(url) {
    try {
        if (!url) return 'Store';
        const parsed = new URL(url);
        let hostname = parsed.hostname.replace(/^www\./, '');
        if (hostname.includes('amazon')) return 'Amazon';
        if (hostname.includes('bambulab')) return 'Bambu Lab';
        if (hostname.includes('frame')) return 'Framework';

        const parts = hostname.split('.');
        const domain = parts.length >= 2 ? parts[parts.length - 2] : hostname;
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {
        return 'Store';
    }
}

function parseAmount(value) {
    const normalized = String(value ?? '').replace(/[$,\s]/g, '');
    return normalized ? Number(normalized) : NaN;
}

function formatPrice(value) {
    const match = String(value ?? '').trim().match(/^\$?\s*(-?)([\d,]+)(\.\d+)?$/);
    if (!match) return String(value ?? '').trim();

    const integerPart = match[2].replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${match[1]}${integerPart}${match[3] || ''}`;
}

function getFormattedDate() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
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
    if (Date.now() - lastSaveTimestamp < 8000) return;

    const fetchStartTime = Date.now();
    if (sheetWebAppUrl) {
        try {
            const url = sheetWebAppUrl + (sheetWebAppUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
            const res = await fetch(url, { redirect: "follow" });

            if (lastSaveTimestamp > fetchStartTime) return;

            if (res.ok) {
                const fetchedData = await res.json();
                if (Array.isArray(fetchedData)) {
                    itemsLoaded = true;
                    const newItems = fetchedData.map((item, idx) => {
                        const itemUrl = item.url || "";
                        const storeName = item.store && item.store.trim() !== "" ? item.store : extractStoreName(itemUrl);
                        return {
                            id: String(idx + 1),
                            title: item.title || "Untitled Item",
                            url: itemUrl,
                            imageUrl: item.imageUrl || "",
                            price: item.price ? String(item.price) : "",
                            amountRemaining: item.amountRemaining !== undefined && item.amountRemaining !== null && item.amountRemaining !== ""
                                ? String(item.amountRemaining)
                                : (item.price ? String(item.price) : "0.00"),
                            bulkOrder: (item.bulkOrder === true || String(item.bulkOrder).toLowerCase() === 'true' || item.bulkOrder === 1),
                            isGroupGift: (item.isGroupGift === true || String(item.isGroupGift).toLowerCase() === 'true' || item.isGroupGift === 1),
                            store: storeName,
                            purchased: (item.purchased === true || String(item.purchased).toLowerCase() === 'true' || item.purchased === 1),
                            buyerName: item.buyerName || null,
                            purchaseDate: item.purchaseDate || null
                        };
                    });

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
    const fallbackItems = saved ? JSON.parse(saved) : [];
    const newItems = fallbackItems.map((item, idx) => {
        const storeName = item.store && item.store.trim() !== "" ? item.store : extractStoreName(item.url);
        const amountRemaining = item.amountRemaining !== undefined && item.amountRemaining !== null && item.amountRemaining !== ""
            ? item.amountRemaining
            : item.price || "0.00";
        return { ...item, id: String(idx + 1), store: storeName, amountRemaining };
    });
    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
        items = newItems;
        saveItems();
    } else {
        renderGrid();
    }
    notifyHomeAssistantIfEmpty();
}

function saveItems() {
    lastSaveTimestamp = Date.now();
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
                <h4 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">All current gifts on list are purchased! 🎉</h4>
                <p class="text-base md:text-lg font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
                    Thank you so much to everyone who purchased a gift for me!
                </p>
            </div>
        `;
        grid.appendChild(card);
        return;
    }

    itemsToDisplay.forEach(item => {
        const hasLink = Boolean(item.url && item.url.trim() !== '');
        const card = document.createElement('div');
        card.className = "group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-md hover:shadow-2xl shadow-slate-200/50 dark:shadow-none card-hover transition-all duration-300";

        const imgContainer = document.createElement('div');
        imgContainer.className = "relative h-52 bg-slate-100 dark:bg-slate-950 overflow-hidden";

        const imgSrc = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : '';
        const displayPrice = item.price;
        const formattedPrice = displayPrice ? formatPrice(displayPrice) : '';

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

        if (item.bulkOrder) {
            imgHtml = `
                <button type="button" class="block w-full h-full text-left" aria-label="Reserve ${escapeHtml(item.title)} as part of the bulk order">
                    ${imgHtml}
                </button>
            `;
        } else if (hasLink) {
            imgHtml = `
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="block w-full h-full" title="View product link">
                    ${imgHtml}
                </a>
            `;
        }

        imgContainer.innerHTML = imgHtml;
        const bulkOrderImageButton = imgContainer.querySelector('button');
        if (bulkOrderImageButton) {
            bulkOrderImageButton.addEventListener('click', () => {
                openClaimModal(item.id, item.title, item.url, item.price, item.bulkOrder, item.store);
            });
        }
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

        if (item.bulkOrder) {
            const bulkBadge = document.createElement('button');
            bulkBadge.type = 'button';
            bulkBadge.className = 'wishlist-bulk-badge w-full py-2 px-3 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors';
            bulkBadge.onclick = () => openClaimModal(item.id, item.title, item.url, item.price, item.bulkOrder, item.store);
            bulkBadge.innerHTML = '<i class="fa-solid fa-boxes-stacked text-xs"></i> Part of a Bulk Order';
            contentSection.appendChild(bulkBadge);
        } else if (item.isGroupGift) {
            const groupBadge = document.createElement(hasLink ? 'button' : 'div');
            groupBadge.className = `wishlist-group-badge w-full py-2 px-3 rounded-xl border shadow-sm space-y-2${hasLink ? ' text-left cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-colors' : ''}`;
            if (hasLink) {
                groupBadge.type = 'button';
                groupBadge.setAttribute('aria-label', `Contribute to ${item.title}`);
                groupBadge.onclick = () => window.open(item.url, '_blank', 'noopener,noreferrer');
            }
            const remVal = item.amountRemaining !== undefined && item.amountRemaining !== null && item.amountRemaining !== ""
                ? item.amountRemaining
                : item.price;
            const groupBadgeHeader = document.createElement('div');
            groupBadgeHeader.className = 'flex items-center justify-between gap-2 text-xs font-semibold';

            const groupBadgeTitle = document.createElement('span');
            groupBadgeTitle.className = 'flex items-center gap-1.5';
            groupBadgeTitle.innerHTML = '<i class="fa-solid fa-users text-purple-500"></i> Group Gift';

            const remainingLabel = document.createElement('span');
            remainingLabel.className = 'font-bold';
            remainingLabel.textContent = `Remaining: ${formatPrice(remVal)}`;

            groupBadgeHeader.appendChild(groupBadgeTitle);
            groupBadgeHeader.appendChild(remainingLabel);
            groupBadge.appendChild(groupBadgeHeader);

            const totalAmount = parseAmount(item.price);
            const remainingAmount = parseAmount(remVal);
            if (Number.isFinite(totalAmount) && totalAmount > 0 && Number.isFinite(remainingAmount)) {
                const fundedPercentage = Math.min(100, Math.max(0, ((totalAmount - remainingAmount) / totalAmount) * 100));
                const roundedPercentage = Math.round(fundedPercentage);
                const progressContainer = document.createElement('div');
                progressContainer.className = 'wishlist-group-progress space-y-1.5';

                const progressLabel = document.createElement('div');
                progressLabel.className = 'flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300';
                progressLabel.innerHTML = `<span>Funding progress</span><span>${roundedPercentage}% funded</span>`;

                const progressBar = document.createElement('div');
                progressBar.className = 'wishlist-group-progress-track';
                progressBar.setAttribute('role', 'progressbar');
                progressBar.setAttribute('aria-label', 'Group gift funding progress');
                progressBar.setAttribute('aria-valuemin', '0');
                progressBar.setAttribute('aria-valuemax', '100');
                progressBar.setAttribute('aria-valuenow', String(roundedPercentage));
                progressBar.setAttribute('aria-valuetext', `${roundedPercentage}% funded`);

                const progressFill = document.createElement('div');
                progressFill.className = 'wishlist-group-progress-fill';
                progressFill.style.width = `${fundedPercentage}%`;
                progressBar.appendChild(progressFill);

                progressContainer.appendChild(progressLabel);
                progressContainer.appendChild(progressBar);
                groupBadge.appendChild(progressContainer);
            }
            contentSection.appendChild(groupBadge);
        } else if (hasLink) {
            const linkBtn = document.createElement('a');
            linkBtn.href = item.url;
            linkBtn.target = '_blank';
            linkBtn.rel = 'noopener noreferrer';
            linkBtn.className = 'wishlist-item-link w-full py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs flex items-center justify-center gap-2 transition-colors';
            linkBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square text-xs"></i> View Item Online';
            contentSection.appendChild(linkBtn);
        }

        const actionsSection = document.createElement('div');
        actionsSection.className = "pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80";

        const claimBtn = document.createElement('button');
        if (item.isGroupGift && hasLink) {
            claimBtn.onclick = () => window.open(item.url, '_blank', 'noopener,noreferrer');
            claimBtn.className = "wishlist-claim-button w-full py-3 px-4 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98]";
            claimBtn.innerHTML = '<i class="fa-solid fa-gift text-sm"></i> I will contribute to this gift';
        } else {
            claimBtn.onclick = () => openClaimModal(item.id, item.title, item.url, item.price, item.bulkOrder, item.store);
            claimBtn.className = "wishlist-claim-button w-full py-3 px-4 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98]";
            claimBtn.innerHTML = '<i class="fa-solid fa-gift text-sm"></i> I\'ll Get This Gift!';
        }
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

function openClaimModal(id, title, url, price, bulkOrder, store) {
    document.getElementById('claimItemId').value = id;

    const cachedName = localStorage.getItem('wishlist_visitor_name');
    if (cachedName) {
        document.getElementById('buyerName').value = cachedName;
    }

    const linkedNotice = document.getElementById('linkedItemNotice');
    const bulkNotice = document.getElementById('bulkOrderNotice');
    const modalLink = document.getElementById('modalItemLink');
    const storeName = store && store.trim() !== '' ? store : 'Store';

    if (bulkOrder) {
        linkedNotice.classList.add('hidden');
        bulkNotice.classList.remove('hidden');

        document.getElementById('claimModalTitle').textContent = `${storeName}'s Bulk Order`;
        document.getElementById('bulkOrderNoticeHeader').textContent = `${storeName}'s Bulk Order`;
        document.getElementById('claimSubmitBtn').textContent = 'Reserve for Bulk Order';

        const formattedPrice = price ? formatPrice(price) : '';
        document.getElementById('bulkOrderText').innerHTML = `Reserving this item adds it to our shared bulk order. Please give <strong>${formattedPrice}</strong> to Michael or Rebecca.`;
    } else {
        bulkNotice.classList.add('hidden');
        linkedNotice.classList.remove('hidden');

        const hasLink = Boolean(url && url.trim() !== '');
        if (hasLink) {
            modalLink.href = url;
            modalLink.classList.remove('hidden');
        } else {
            modalLink.href = '#';
            modalLink.classList.add('hidden');
        }

        document.getElementById('claimModalTitle').textContent = 'Mark as Purchased';
        document.getElementById('claimSubmitBtn').textContent = 'Confirm Purchase';
    }

    document.getElementById('claimModal').classList.remove('hidden');
}

function closeClaimModal() {
    document.getElementById('claimModal').classList.add('hidden');
}

function handleClaimSubmit(event) {
    event.preventDefault();
    const itemId = document.getElementById('claimItemId').value;
    const buyerName = document.getElementById('buyerName').value.trim();
    const formattedDate = getFormattedDate();

    if (buyerName) {
        localStorage.setItem('wishlist_visitor_name', buyerName);
    }

    let target = items.find(i => i.id === itemId);
    const isBulk = Boolean(target && target.bulkOrder);

    if (target) {
        target.purchased = true;
        target.buyerName = buyerName;
        target.purchaseDate = formattedDate;
    }
    saveItems();
    closeClaimModal();
    showToast(isBulk
        ? "Thank you! Reserved as part of the bulk order."
        : "Thank you! Item marked as purchased.");
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
