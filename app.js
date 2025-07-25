document.addEventListener("DOMContentLoaded", () => {
    const ANNOUNCEMENT_HTML_CONTENT = `
        <h4>欢迎与说明</h4>
        <p>本项目旨在提供一个干净美观的阅读榜单参考，通常每2-3天更新一次。</p>
        
        <h4>名词解释 & FAQ</h4>
        <ul>
            <li><strong>「NEW」标签:</strong> 指与上一次榜单数据对比，该书籍新进入榜单。</li>
            <li><strong>数据偶有异常 (如“未知类型”):</strong> 这是资源出现了错误，会在下一个更新尝试自我修复，请耐心等待即可。</li>
        </ul>

        <hr>
        
        <h4>免责声明</h4>
        <p>本项目为非官方的个人学习项目，旨在技术交流与分享，<strong>不保证数据的绝对准确性与服务的永久可用性。</strong></p>
        <p>所有数据请以官方为准，请勿用于任何商业目的或进行大规模宣传。</p>
`
    // --- 全局状态变量 ---
    let fullData = null
    let currentlyDisplayedBooks = [] // 【新增】存储当前渲染的书籍，用于详情查询
    let currentChannel = "all"
    let filterState = {
        status: "all",
        showNewOnly: false,
        excludedCategories: new Set(),
    }

    // --- DOM元素获取 ---
    const infoBtn = document.getElementById("info-btn")
    const tableContainer = document.getElementById("table-container")
    const channelSwitcher = document.querySelector(".channel-switcher")

    // 移动端和详情面板相关DOM
    const mobileViewContainer = document.getElementById("mobile-view-container")
    const detailsOverlay = document.getElementById("details-overlay")
    const detailsDrawer = document.getElementById("details-drawer")
    const closeDetailsBtn = document.getElementById("close-details-btn")
    const detailsTitle = document.getElementById("details-title")
    const detailsContent = document.getElementById("details-content")

    // 筛选相关DOM (无变化)
    const filterBtn = document.getElementById("filter-btn")
    const filterOverlay = document.getElementById("filter-overlay")
    const filterDrawer = document.getElementById("filter-drawer")
    const closeDrawerBtn = document.getElementById("close-drawer-btn")
    const applyFilterBtn = document.getElementById("apply-filter-btn")
    const resetFilterBtn = document.getElementById("reset-filter-btn")
    const statusFilterGroup = document.getElementById("status-filter-group")
    const newOnlyCheckbox = document.getElementById("new-only-checkbox")
    const categoryContainer = document.getElementById("category-filter-container")

    // 公告弹窗相关DOM
    const announcementOverlay = document.getElementById("announcement-overlay")
    const announcementModal = document.getElementById("announcement-modal")
    const modalCloseBtn = document.getElementById("modal-close-btn")
    const modalUpdateTime = document.getElementById("modal-update-time")
    const modalStaticContent = document.getElementById("modal-static-content")

    // --- 数据获取与初始化 ---
    fetch("./report_data.json")
        .then((response) => (response.ok ? response.json() : Promise.reject(`HTTP error! status: ${response.status}`)))
        .then((data) => {
            fullData = data
            render()
        })
        .catch(handleError)

    // --- 事件监听 ---
    channelSwitcher.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" && e.target.dataset.channel) {
            if (currentChannel === e.target.dataset.channel) return // 如果点击的是当前频道，则不执行任何操作

            currentChannel = e.target.dataset.channel

            // 【关键新增】在渲染新频道前，重置所有筛选状态
            resetFilters()

            render()
        }
    })
    infoBtn.addEventListener("click", () => {
        // 1. 填充静态内容
        modalStaticContent.innerHTML = ANNOUNCEMENT_HTML_CONTENT

        // 2. 填充动态内容
        if (fullData && fullData.updateTime) {
            modalUpdateTime.textContent = `数据更新于: ${fullData.updateTime}`
        } else {
            modalUpdateTime.textContent = "数据正在加载中..."
        }

        // 3. 显示弹窗
        toggleModal(true)
    })
    // 筛选抽屉事件监听 (无变化)
    filterBtn.addEventListener("click", () => {
        // 【新增】在打开抽屉前，根据当前频道动态生成筛选器
        setupDynamicFilters(currentChannel)
        toggleDrawer("filter", true)
    })
    closeDrawerBtn.addEventListener("click", () => toggleDrawer("filter", false))
    filterOverlay.addEventListener("click", () => toggleDrawer("filter", false))
    applyFilterBtn.addEventListener("click", () => {
        updateFilterStateFromUI()
        toggleDrawer("filter", false)
        render()
    })
    resetFilterBtn.addEventListener("click", () => {
        resetFilters() // 调用我们强大的新函数，它已经处理了一切
        // 无需再调用 updateFilterStateFromUI()
        toggleDrawer("filter", false)
        render()
    })

    // 详情面板事件监听
    mobileViewContainer.addEventListener("click", handleCardClick)
    closeDetailsBtn.addEventListener("click", () => toggleDrawer("details", false))
    detailsOverlay.addEventListener("click", () => toggleDrawer("details", false))
    // 【新增】公告弹窗关闭事件
    modalCloseBtn.addEventListener("click", () => toggleModal(false))
    announcementOverlay.addEventListener("click", () => toggleModal(false))

    // --- 函数定义 ---
    let toastTimer = null
    function showToast(message) {
        // 清除上一个定时器，防止快速点击时出问题
        if (toastTimer) {
            clearTimeout(toastTimer)
        }

        // 寻找或创建Toast元素
        let toast = document.getElementById("toast-notification")
        if (!toast) {
            toast = document.createElement("div")
            toast.id = "toast-notification"
            document.body.appendChild(toast)
        }

        toast.innerHTML = message // 【关键修改】使用innerHTML来解析HTML标签
        toast.classList.add("show")

        // 3秒后自动隐藏
        toastTimer = setTimeout(() => {
            toast.classList.remove("show")
        }, 3000)
    }

    function toggleDrawer(type, open) {
        const bodyClass = type === "filter" ? "drawer-open" : "details-open"
        document.body.classList.toggle(bodyClass, open)
    }

    function updateActiveUI() {
        // 同步频道切换器
        channelSwitcher.querySelectorAll("button").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.channel === currentChannel)
        })
    }

    function handleError(error) {
        console.error("Error:", error)
        // 【已修改】移除对updateTimeEl的引用，将错误信息统一展示在主内容区
        const errorMessage = `
        <div style="padding: 40px 20px; text-align: center;">
            <h3 style="color: #d9534f; margin-bottom: 10px;">糟糕，加载失败了</h3>
            <p style="color: #6c757d;">无法获取榜单数据，请检查网络连接或确认数据文件是否存在。</p>
        </div>
    `
        tableContainer.innerHTML = errorMessage
        mobileViewContainer.innerHTML = errorMessage // 【新增】确保移动端也显示错误信息
    }
    function setupDynamicFilters(channel) {
        if (!fullData || !fullData[channel] || !fullData[channel].onRank) {
            categoryContainer.innerHTML = '<p class="loading-text">当前频道无类型数据</p>'
            return
        }

        const channelCategories = new Set()
        fullData[channel].onRank.forEach((book) => channelCategories.add(book.category))

        categoryContainer.innerHTML = "" // 清空旧列表

        // 根据当前筛选状态，决定复选框是否被勾选
        const previouslyExcluded = new Set(filterState.excludedCategories)

        Array.from(channelCategories)
            .sort()
            .forEach((category) => {
                const isChecked = previouslyExcluded.has(category) ? "checked" : ""
                const label = document.createElement("label")
                label.className = "checkbox-label"
                label.innerHTML = `<input type="checkbox" data-category="${category}" ${isChecked}> ${category}`
                categoryContainer.appendChild(label)
            })
    }

    function updateFilterStateFromUI() {
        // 更新状态
        filterState.status = statusFilterGroup.querySelector(".active").dataset.status
        // 更新新入榜
        filterState.showNewOnly = newOnlyCheckbox.checked
        // 更新排除类型
        filterState.excludedCategories.clear()
        categoryContainer.querySelectorAll('input[type="checkbox"]:checked').forEach((checkbox) => {
            filterState.excludedCategories.add(checkbox.dataset.category)
        })
    }

    function resetFilters() {
        // 1. 重置UI控件
        statusFilterGroup.querySelector(".active")?.classList.remove("active")
        statusFilterGroup.querySelector('[data-status="all"]').classList.add("active")
        newOnlyCheckbox.checked = false
        // 在重新生成列表前，我们只需清空逻辑状态即可，无需操作DOM
        // categoryContainer.querySelectorAll("input:checked").forEach((c) => (c.checked = false));

        // 2. 【关键新增】重置内存中的逻辑状态对象
        filterState.status = "all"
        filterState.showNewOnly = false
        filterState.excludedCategories.clear()
    }

    // 【已修改】Render函数现在会同时渲染两个视图
    function render() {
        if (!fullData) return
        updateActiveUI()

        // 【过滤管道】
        let booksToRender = fullData[currentChannel]?.onRank || []
        if (filterState.status !== "all") {
            booksToRender = booksToRender.filter((b) => b.status === filterState.status)
        }
        if (filterState.showNewOnly) {
            booksToRender = booksToRender.filter((b) => b.isNew)
        }
        if (filterState.excludedCategories.size > 0) {
            booksToRender = booksToRender.filter((b) => !filterState.excludedCategories.has(b.category))
        }

        currentlyDisplayedBooks = booksToRender // 【新增】缓存当前渲染的书籍

        const message = `<p style="text-align:center; padding: 20px; color: #6c757d;">没有找到符合条件的书籍。</p>`

        // 渲染桌面表格
        tableContainer.innerHTML = booksToRender.length > 0 ? createTableHTML(booksToRender) : message
        // 渲染移动端卡片
        mobileViewContainer.innerHTML = booksToRender.length > 0 ? createMobileCardsHTML(booksToRender) : message
    }

    function createTableHTML(dataArray) {
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>排名</th><th>书名</th><th>作者</th><th>状态</th><th>类型</th><th>字数(w)</th>
                    </tr>
                </thead>
                <tbody>
        `
        dataArray.forEach((book, index) => {
            const highlightClass = book.isNew ? "new-book-highlight" : ""
            html += `
                <tr class="${highlightClass}">
                    <td>${index + 1}</td>
                    <td>${book.title}</td>
                    <td>${book.author}</td>
                    <td>${book.status}</td>
                    <td>${book.category}</td>
                    <td>${book.wordCount}</td>
                </tr>
            `
        })
        html += `</tbody></table>`
        return html
    }

    // 【新增】创建移动端卡片列表HTML的函数
    function createMobileCardsHTML(dataArray) {
        return dataArray
            .map(
                (book, index) => `
            <div class="book-card" data-book-index="${index}">
                <div class="rank">${index + 1}</div>
                <div class="book-details">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-category">${book.category}</p>
                </div>
                ${book.isNew ? '<div class="new-badge">NEW</div>' : ""}
            </div>
        `
            )
            .join("")
    }

    // 【新增】处理卡片点击事件的函数
    function handleCardClick(event) {
        const card = event.target.closest(".book-card")
        if (!card) return

        const bookIndex = parseInt(card.dataset.bookIndex, 10)
        const bookData = currentlyDisplayedBooks[bookIndex]

        if (bookData) {
            showDetailsPanel(bookData)
        }
    }

    // 【新增】显示书籍详情面板的函数
function showDetailsPanel(book) {
    // 我们给书名元素一个ID，方便后续绑定事件
    detailsTitle.innerHTML = `<span id="copyable-title">${book.title}</span>`
    detailsContent.innerHTML = `
        <ul>
            <li><span class="detail-label">作者</span><span class="detail-value">${book.author}</span></li>
            <li><span class="detail-label">状态</span><span class="detail-value">${book.status}</span></li>
            <li><span class="detail-label">类型</span><span class="detail-value">${book.category}</span></li>
            <li><span class="detail-label">字数</span><span class="detail-value">${book.wordCount}</span></li>
            <li><span class="detail-label">入榜状态</span><span class="detail-value">${book.isNew ? "本次新入榜" : "持续在榜"}</span></li>
        </ul>
        <p class="copy-tip">（点击书名可直接复制）</p> 
    `
    toggleDrawer("details", true)

    // 【关键新增】在详情面板渲染并弹出后，再获取书名元素并绑定事件
    const copyableTitle = document.getElementById("copyable-title")
    if (copyableTitle) {
        copyableTitle.addEventListener("click", () => {
            // 使用 Clipboard API 写入剪贴板
            navigator.clipboard
                .writeText(book.title)
                .then(() => {
                    // 成功后给予Toast提示
                    showToast("书名已复制！")
                })
                .catch((err) => {
                    // 失败时在控制台打印错误，并给予用户提示
                    console.error("复制失败: ", err)
                    showToast("复制失败，您的浏览器可能不支持此功能。")
                })
        })
    }
}
    function toggleModal(open) {
        document.body.classList.toggle("modal-open", open)
    }

    // --- 筛选抽屉内部交互 ---
    statusFilterGroup.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            statusFilterGroup.querySelector(".active").classList.remove("active")
            e.target.classList.add("active")
        }
    })
})
