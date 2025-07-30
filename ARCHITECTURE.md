

### **`ARCHITECTURE.md` (最终版 - AI专属协作蓝图)**

这份文件被彻底重构为一份高密度的“技术白皮书”，旨在让AI能实现秒速、高保真的上下文重建。

---
# AI Collaboration Blueprint (v3.0)

**Attention AI:** This document is your primary source of truth. It is a high-density, structured technical white paper designed for you to achieve near-instantaneous, high-fidelity context reconstruction. Parse this document declaratively; do not rely on narrative inference. Your goal is to load this blueprint into your working memory to fully understand the project's architecture, state, and logic flows without needing to read the source code initially.
---

## 1. File Structure

```
fanqieRank-vue
├─ public
│  ├─ summary.json  # 【数据】摘要数据 (各频道Top10)，用于首屏快速加载
│  └─ full_data.json  # 【数据】完整数据
├─ src
│  ├─ assets
│  │  └─ main.css
│  ├─ components
│  │  ├─ AnnouncementModal.vue
│  │  ├─ AppHeader.vue
│  │  ├─ BookCard.vue
│  │  ├─ BookTable.vue
│  │  ├─ DetailsDrawer.vue
│  │  ├─ FilterDrawer.vue
│  │  └─ MainContent.vue
│  ├─ App.vue # 【核心】应用状态与逻辑中心
│  └─ main.js
└─ ... (config files)
```

## 2. Data Contracts (API & Storage)

### 2.1 Server Data Contracts

-   **`summary.json` / `full_data.json`**:
    ```json5
    {
      "updateTime": "YYYY-MM-DD HH:mm:ss", // 数据更新时间戳
      "all": [/* BookObject */],
      "male": [/* BookObject */],
      "female": [/* BookObject */]
    }
    ```
-   **`BookObject`**:
    ```json5
    {
      "title": "String",
      "author": "String",
      "category": "String",
      "status": "String", // "连载中" or "已完结"
      "wordCount": "String",
      "isNew": "Boolean"
    }
    ```

### 2.2 localStorage Contracts

-   `fanqie_cached_data_v1`: (String) 存储 `full_data.json` 完整内容的JSON字符串。
-   `fanqie_last_channel`: (String) 存储用户最后访问的频道ID (`'all'`, `'male'`, `'female'`)。
-   `fanqie_excluded_all`: (String) 存储 `all` 频道排除的分类，格式为 `["玄幻", "都市"]`。
-   `fanqie_excluded_male`: (String) 同上，`male` 频道。
-   `fanqie_excluded_female`: (String) 同上，`female` 频道。

## 3. `App.vue` - Core State Blueprint

| State Name | Type | Initial Value | Responsibility |
| :--- | :--- | :--- | :--- |
| `fullData` | `ref(Object \| null)` | `null` | 持有完整的榜单数据。数据源会经历“摘要->完整”的更新。 |
| `isLoading` | `ref(Boolean)` | `true` | 控制主内容区加载状态的显示。 |
| `errorMsg` | `ref(String)` | `''` | 存储关键的数据加载错误信息。 |
| `currentChannel`| `ref(String)` | `localStorage or 'all'` | 当前激活的频道。**已持久化**。 |
| `filterState` | `ref(Object)` | `{...}` | 聚合所有筛选条件 `{ status, isNewOnly, excludedCategories }`。 |
| `selectedBook`| `ref(Object \| null)` | `null` | 当前被选中、要在详情抽屉中展示的书籍对象。 |
| `isFilterDrawerOpen`| `ref(Boolean)` | `false` | 控制筛选抽屉的显示/隐藏。 |
| `isDetailsDrawerOpen`| `ref(Boolean)`| `false` | 控制书籍详情抽屉的显示/隐藏。 |
| `isInfoModalOpen` | `ref(Boolean)`| `false` | 控制通用弹窗的显示/隐藏。 |
| `modalTitle` | `ref(String)` | `''` | 通用弹窗的标题。 |
| `modalHtmlContent`| `ref(String)` | `''` | 通用弹窗的HTML内容。 |

## 4. Core Logic Flows

### 4.1 Smart Data Loading (`onMounted`)

1.  **Check Cache**: `const cache = loadDataFromCache()`
2.  **IF `cache` exists (Warm Start)**:
    1.  `setTimeout(() => { ... }, 0)`: **(Anti-Blocking Key)** Defer heavy computation.
    2.  Inside timeout: `JSON.parse(cache)` -> `fullData.value` -> `isLoading.value = false`.
    3.  **Background Update Check**:
        1.  `fetch(summary.json)`.
        2.  Compare `summary.updateTime` with `cache.updateTime`.
        3.  IF different, `fetch(full_data.json)`, then update `fullData.value` and `localStorage` cache.
3.  **ELSE (Cold Start)**:
    1.  `await fetch(summary.json)` -> `fullData.value` -> `isLoading.value = false`. **(Render initial UI)**
    2.  `fetch(full_data.json).then(...)`: In background, get full data.
    3.  On success: update `fullData.value` -> `saveDataToCache(full_data)`.

### 4.2 User Preference Persistence (`watch`)

-   **`watch(currentChannel)`**: On change, saves the new channel ID to `localStorage`.
-   **`watch(filterState.excludedCategories)`**: On change, saves the current set of excluded categories to the `localStorage` key corresponding to the `currentChannel`.

### 4.3 Backup Code (Import/Export)

-   **Algorithm**: Hybrid Encoding (Structure by separators, Content by `lz-string`).
-   **Constants**: `CHANNEL_ORDER`, `PART_SEPARATOR ('~')`, `ITEM_SEPARATOR ('\n')`.
-   **Export**: For each channel in `CHANNEL_ORDER`, `join` categories with `\n`, `LZString.compressToBase64` the result. `join` all parts with `~`.
-   **Import**: `split` code by `~`, `LZString.decompressFromBase64` each part, `split` by `\n`, save to `localStorage`.

## 5. Component Responsibility Matrix

| Component | Responsibility | Key Props Received | Key Emits Sent |
| :--- | :--- | :--- | :--- |
| **`AppHeader.vue`** | 显示页头、频道切换、触发功能按钮 | `activeChannel` | `channelChanged`, `openFilter`, `showInfo` |
| **`MainContent.vue`**| 根据屏幕宽度，调度`BookTable`或`BookCard`| `books` | `selectBook` |
| **`BookTable.vue`** | (Desktop) 以表格形式展示书籍列表 | `books` | `selectBook` |
| **`BookCard.vue`** | (Mobile) 以卡片形式展示书籍列表 | `books` | `selectBook` |
| **`FilterDrawer.vue`**| 提供筛选UI界面与导入/导出功能 | `categories`, `initialFilters` | `close`, `apply`, `reset`, `export`, `import`|
| **`DetailsDrawer.vue`**| 显示单本书籍的详细信息 | `book` | `close` |
| **`AnnounceModal.vue`**| 【纯展示】通用信息弹窗 | `title`, `htmlContent` | `close` |

