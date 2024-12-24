// グローバル状態
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let products = [];
let myProducts = {
    selling: [],
    sold: [],
    purchased: []
};

// API呼び出し
async function callWalletApi(action, data, showLoadingIndicator = true) {
    try {
        if (showLoadingIndicator) showLoading();
        const formData = new URLSearchParams();
        formData.append('action', action);
        formData.append('data', JSON.stringify(data));

        const response = await fetch(WALLET_API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
    } catch (error) {
        throw error;
    } finally {
        if (showLoadingIndicator) hideLoading();
    }
}

async function callMarketApi(action, data, showLoadingIndicator = true) {
    try {
        if (showLoadingIndicator) showLoading();
        const formData = new URLSearchParams();
        formData.append('action', action);
        formData.append('data', JSON.stringify(data));

        const response = await fetch(MARKET_API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
    } catch (error) {
        throw error;
    } finally {
        if (showLoadingIndicator) hideLoading();
    }
}

// UI制御
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showMessage(message, isError = false) {
    const messageEl = document.getElementById('message');
    const messageText = document.getElementById('message-text');
    messageEl.classList.remove('hidden');
    messageEl.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    messageText.textContent = message;
    setTimeout(() => messageEl.classList.add('hidden'), 3000);
}

// 画像処理関連
async function resizeImage(file, maxWidth = 400, maxHeight = 400) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // アスペクト比を維持しながらリサイズ
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // 画質改善設定
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, width, height);

            // JPEG形式で出力（品質80%）
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = URL.createObjectURL(file);
    });
}

async function convertImageToBase64(file) {
    if (!file) return null;

    try {
        const resizedImage = await resizeImage(file);
        return resizedImage;
    } catch (error) {
        console.error('Image processing error:', error);
        throw new Error('画像の処理中にエラーが発生しました');
    }
}

// ログインモーダル関連
function showLoginModal() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('login-modal');
        const form = document.getElementById('wallet-login-form');

        modal.classList.remove('hidden');

        window.handleWalletLogin = (event) => {
            event.preventDefault();
            const credentials = {
                username: document.getElementById('wallet-username').value,
                password: document.getElementById('wallet-password').value
            };
            closeLoginModal();
            resolve(credentials);
        };

        modal.onclick = (event) => {
            if (event.target === modal) {
                closeLoginModal();
                reject(new Error('キャンセルされました'));
            }
        };
    });
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.classList.add('hidden');
    document.getElementById('wallet-login-form').reset();
}

// 商品詳細モーダル
function showProductDetail(product) {
    if (!product) return;

    const modal = document.getElementById('product-modal');
    const modalImage = document.getElementById('modal-image');
    const modalName = document.getElementById('modal-name');
    const modalDescription = document.getElementById('modal-description');
    const modalPrice = document.getElementById('modal-price');
    const modalSeller = document.getElementById('modal-seller');
    const purchaseBtn = document.getElementById('purchase-btn');

    modalImage.src = product.image || 'assets/no-image.png';
    modalName.textContent = product.name;
    modalDescription.textContent = product.description || '説明はありません';
    modalPrice.textContent = product.price.toLocaleString();
    modalSeller.textContent = product.sellerId;

    purchaseBtn.style.display = currentUser ? 'block' : 'none';
    if (currentUser) {
        purchaseBtn.onclick = () => handlePurchase(product);
    }

    modal.classList.remove('hidden');

    document.querySelector('.close-btn').onclick = closeProductModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeProductModal();
    };
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// ウォレット連携
async function connectWallet() {
    try {
        const credentials = await showLoginModal();
        const userData = await callWalletApi('login', credentials);
        currentUser = userData;

        localStorage.setItem('currentUser', JSON.stringify(userData));

        document.getElementById('wallet-connect').classList.add('hidden');
        document.getElementById('market-content').classList.remove('hidden');
        updateNavButtons();
        updateUserInfo();

        await loadMyProducts();
        showMessage(`ようこそ、${userData.username}さん`);
    } catch (error) {
        if (error.message !== 'キャンセルされました') {
            showMessage(error.message, true);
        }
    }
}

function disconnectWallet() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    myProducts = { selling: [], sold: [], purchased: [] };

    document.getElementById('wallet-connect').classList.remove('hidden');
    document.getElementById('market-content').classList.add('hidden');
    updateNavButtons();
    renderMyProducts();

    showMessage('ウォレットとの連携を解除しました');
}

// 商品関連
async function loadProducts() {
    try {
        products = await callMarketApi('getProducts', {}, false);
        renderProducts();
    } catch (error) {
        showMessage('商品の読み込みに失敗しました', true);
    }
}

async function loadMyProducts() {
    if (!currentUser) return;

    try {
        myProducts = await callMarketApi('getMyProducts', {
            userId: currentUser.accountId
        }, false);
        renderMyProducts();
    } catch (error) {
        showMessage('商品の読み込みに失敗しました', true);
    }
}

function renderProducts(productList = products) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    if (productList.length === 0) {
        container.innerHTML = '<p class="no-items">商品がありません</p>';
        return;
    }

    productList.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

function renderMyProducts() {
    const renderList = (products, containerId, emptyMessage) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (!products || products.length === 0) {
            container.innerHTML = `<p class="no-items">${emptyMessage}</p>`;
            return;
        }

        products.forEach(product => {
            const div = document.createElement('div');
            div.className = 'transaction-item';
            div.innerHTML = `
                <div class="transaction-info">
                    <h4 class="product-name">${product.name}</h4>
                    <p class="product-price">${product.price.toLocaleString()} W</p>
                    <p class="transaction-date">
                        ${new Date(product.purchaseDate || product.createdAt).toLocaleString()}
                    </p>
                </div>
            `;
            container.appendChild(div);
        });
    };

    renderList(myProducts.selling, 'selling-list', '出品中の商品はありません');
    renderList(myProducts.sold, 'sold-list', '売却済みの商品はありません');
    renderList(myProducts.purchased, 'purchased-list', '購入した商品はありません');
}

function createProductCard(product) {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
        <img src="${product.image || 'assets/no-image.png'}" alt="${product.name}" class="product-image">
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-price">${product.price.toLocaleString()} W</p>
        </div>
    `;
    div.onclick = () => showProductDetail(product);
    return div;
}

async function handleSell(event) {
    event.preventDefault();

    try {
        const formData = new FormData(event.target);
        const image = await convertImageToBase64(formData.get('image'));

        const productData = {
            name: formData.get('name'),
            description: formData.get('description'),
            price: parseInt(formData.get('price')),
            image,
            sellerId: currentUser.accountId
        };

        await callMarketApi('addProduct', productData);
        await Promise.all([
            loadProducts(),
            loadMyProducts()
        ]);

        event.target.reset();
        document.getElementById('image-preview').innerHTML = '';
        showMessage('商品を出品しました');
        alert('出品が完了しました！');
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function handlePurchase(product) {
    try {
        if (!currentUser) throw new Error('ウォレットと連携してください');
        if (product.sellerId === currentUser.accountId) {
            throw new Error('自分の商品は購入できません');
        }

        if (currentUser.balance < product.price) {
            throw new Error('残高が不足しています');
        }

        await callWalletApi('transfer', {
            fromAccountId: currentUser.accountId,
            toAccountId: product.sellerId,
            amount: product.price
        });

        await callMarketApi('purchaseProduct', {
            productId: product.id,
            buyerId: currentUser.accountId
        });

        await Promise.all([
            loadProducts(),
            loadMyProducts()
        ]);

        closeProductModal();
        showMessage('商品を購入しました');
        alert('購入が完了しました！');
    } catch (error) {
        showMessage(error.message, true);
    }
}

// ユーティリティ
function updateUserInfo() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('account-id').textContent = currentUser.accountId;
    document.getElementById('balance').textContent = currentUser.balance.toLocaleString();
}

function updateNavButtons() {
    const navButtons = document.getElementById('nav-buttons');
    if (currentUser) {
        navButtons.innerHTML = `
            <span class="user-info">
                <span class="username">${currentUser.username}</span>
                <span class="balance">${currentUser.balance.toLocaleString()} W</span>
            </span>
            <button class="btn btn-outline" onclick="disconnectWallet()">切断</button>
        `;
    } else {
        navButtons.innerHTML = `
            <button class="btn btn-outline" onclick="connectWallet()">ウォレット連携</button>
        `;
    }
}

// イベントリスナー
document.addEventListener('DOMContentLoaded', async () => {
    // まず商品一覧を読み込む（ログイン不要）
    await loadProducts();

    // ログインしている場合は追加データを読み込む
    if (currentUser) {
        try {
            document.getElementById('wallet-connect').classList.add('hidden');
            document.getElementById('market-content').classList.remove('hidden');
            updateNavButtons();
            updateUserInfo();
            await loadMyProducts();
        } catch (error) {
            localStorage.removeItem('currentUser');
            currentUser = null;
            showMessage('セッションが切れました。再度ログインしてください。', true);
            disconnectWallet();
        }
    }

    // タブ切り替え
    document.querySelectorAll('.tabs').forEach(tabsContainer => {
        tabsContainer.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.tab;
                const tabContent = document.getElementById(targetId);

                const tabGroup = button.closest('.tabs').parentElement;
                tabGroup.querySelectorAll('.tab-btn').forEach(btn =>
                    btn.classList.remove('active'));
                tabGroup.querySelectorAll('.tab-content').forEach(content =>
                    content.classList.remove('active'));

                button.classList.add('active');
                tabContent.classList.add('active');
            });
        });
    });

    // 画像プレビュー
    const imageInput = document.getElementById('product-image');
    const imagePreview = document.getElementById('image-preview');

    imageInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64 = await convertImageToBase64(file);
                imagePreview.innerHTML = `<img src="${base64}" alt="プレビュー">`;
            } catch (error) {
                showMessage('画像のプレビューに失敗しました', true);
            }
        }
    });

    // 商品検索
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.querySelector('.search-btn');
    let searchTimeout;

    function performSearch() {
        const keyword = searchInput.value.toLowerCase();
        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(keyword) ||
            product.description?.toLowerCase().includes(keyword)
        );
        renderProducts(filtered);
    }

    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });

    searchBtn?.addEventListener('click', performSearch);

    // 商品並び替え
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        const sortedProducts = [...products].sort((a, b) => {
            switch (sortBy) {
                case 'priceAsc':
                    return a.price - b.price;
                case 'priceDesc':
                    return b.price - a.price;
                case 'new':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
        renderProducts(sortedProducts);
    });
});

// グローバルエラーハンドリング
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    showMessage('エラーが発生しました', true);
});

window.onerror = function (message, source, line, column, error) {
    console.error('Global error:', { message, source, line, column, error });
    showMessage('エラーが発生しました', true);
    return false;
};