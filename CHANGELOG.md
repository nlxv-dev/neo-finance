# Neo Finance v6.5.0 — Accounts, Transfers & Goals Update 💳

**Обновление Neo Finance:** приложение получает полноценную работу с несколькими счетами, переводы между ними, персональные карточки баланса на главном экране и отдельный раздел **«Цели»**. Балансы, история операций и месячная динамика теперь учитываются с привязкой к конкретному счёту.

## ✨ Что нового

### 🏦 Счета и баланс
- **Несколько счетов:** создание, редактирование и архивирование счетов с отдельными остатками.
- **Карточки на главном экране:** основной счёт отображается первым; остальные счета доступны свайпом.
- **Быстрое создание счёта:** новая матовая карточка с плюсом позволяет добавить счёт прямо с главного экрана. Создание также доступно из раздела «Кошелёк».
- **Операции по выбранному счёту:** при создании или редактировании транзакции можно указать счёт, к которому она относится.
- **Индивидуальная динамика:** каждая карточка показывает чистое движение средств по своему счёту за текущий месяц. Начальный баланс не считается доходом за месяц.
- **Раздельные валютные итоги:** суммы в RUB, USD и EUR не объединяются без конвертации.

### ↔️ Переводы между счетами
- **Внутренние переводы:** перемещение средств между активными счетами одной валюты.
- **Согласованные остатки:** сумма списывается со счёта отправителя и зачисляется на счёт получателя.
- **Корректная аналитика:** переводы отражаются в месячной динамике участвующих счетов, но не учитываются как обычные доходы или расходы и не увеличивают расходы бюджета.
- **Защита от некорректных операций:** переводы между разными валютами отключены, пока в приложении нет полноценной модели конвертации.

### 🎯 Цели накопления
- **Отдельный раздел «Цели»:** создание, редактирование и удаление финансовых целей.
- **Контроль прогресса:** целевая и текущая суммы, остаток до цели и визуальный индикатор выполнения.
- **Планирование:** срок достижения и ориентировочная сумма накоплений в месяц.
- **Прозрачное управление прогрессом:** изменение прогресса цели не меняет баланс счетов и не создаёт фиктивных транзакций. Реальное перемещение денег выполняется через переводы между счетами.
- **Без демонстрационных данных:** новые установки начинают с пустого списка целей.

### 🎨 Главный экран и навигация
- **Обновлённая карусель счетов:** компактные карточки в едином визуальном стиле приложения с перелистыванием между счетами.
- **Карточка добавления:** отдельная полупрозрачная карточка с плюсом без лишних подписей и подсказок под каруселью.
- **Обновлённая нижняя навигация:** основные разделы — «Главная», «Статистика», «Кошелёк» и «Цели»; центральная кнопка «+» по-прежнему отвечает за добавление транзакции.

### 💾 Резервное копирование и совместимость
- **Полный JSON-бэкап:** резервная копия включает счета, транзакции, переводы, цели, категории, профиль и настройки приложения.
- **Обновлённый формат резервной копии:** схема v4 сохраняет новые сущности и поддерживает восстановление старых резервных копий предыдущих версий.
- **Проверка перед восстановлением:** данные проверяются до применения; предусмотрена защита от частичного или некорректного восстановления.
- **Расширенный CSV v2:** экспорт сохраняет привязку транзакций к счетам и внутренние переводы. Импорт по-прежнему поддерживает старый восьмиколоночный формат; JSON остаётся полным форматом резервного копирования счетов, переводов и целей.

## 🛠️ Технические детали
- Балансы счетов и история операций используют согласованную финансовую модель.
- Начальный остаток отделён от месячного движения средств.
- Внутренние переводы исключены из обычной аналитики доходов и расходов и расчёта бюджета.
- Валютные суммы учитываются раздельно; автоматическая конвертация между валютами не выполняется.
- Добавлены проверки целостности данных счетов, транзакций, переводов и целей при чтении и восстановлении.

---

## 🇬🇧 Release notes

# Neo Finance v6.5.0 — Accounts, Transfers & Goals Update

**Neo Finance v6.5.0** introduces multi-account management, account-to-account transfers, an account carousel on the Home screen, and a dedicated **Goals** section. Balances, transaction history, and monthly movement are now associated with individual accounts.

### What's new

### 🏦 Accounts & balances
- **Multiple accounts:** create, edit, and archive accounts with separate balances.
- **Home account cards:** the primary account appears first; additional accounts can be browsed with a swipe.
- **Quick account creation:** a frosted-glass add card lets users create an account from Home. Account creation is also available in Wallet.
- **Account-specific transactions:** choose the relevant account when creating or editing a transaction.
- **Individual monthly movement:** each card shows the net movement for its account during the current month. The opening balance is not counted as monthly income.
- **Separate currency totals:** RUB, USD, and EUR are not combined without conversion.

### ↔️ Account transfers
- **Internal transfers:** move funds between active accounts in the same currency.
- **Consistent balances:** the amount is deducted from the source account and credited to the destination account.
- **Accurate analytics:** transfers affect the monthly movement of the participating accounts, but are not treated as regular income or expenses and do not increase budget spending.
- **Cross-currency protection:** transfers between different currencies are disabled until full currency-conversion logic is available.

### 🎯 Savings goals
- **Dedicated Goals section:** create, edit, and delete financial goals.
- **Progress tracking:** target and current amounts, remaining amount, and a visual progress indicator.
- **Planning tools:** target date and an estimated monthly saving amount.
- **Transparent progress updates:** changing goal progress does not change account balances or create fictitious transactions. Actual money movement is handled through account transfers.
- **No demo data:** new installations start with an empty goals list.

### 🎨 Home screen & navigation
- **Account carousel:** compact account cards in the app's visual style, navigable by swiping.
- **Add-account card:** a separate frosted-glass card with a plus icon and no extra caption beneath the carousel.
- **Updated bottom navigation:** Home, Statistics, Wallet, and Goals; the central “+” action continues to add transactions.

### 💾 Backup & compatibility
- **Full JSON backup:** includes accounts, transactions, transfers, goals, categories, profile, and app settings.
- **Updated backup format:** schema v4 stores the new entities and remains compatible with older backup versions.
- **Validation before restore:** data is checked before being applied, with protection against partial or invalid restoration.
- **Extended CSV v2:** exports preserve transaction account assignments and internal transfers. Imports remain compatible with the legacy eight-column format; JSON remains the complete backup format for accounts, transfers, and goals.

### 🛠️ Technical details
- Account balances and transaction history use a consistent financial model.
- Opening balances are kept separate from monthly money movement.
- Internal transfers are excluded from regular income/expense analytics and budget calculations.
- Currency totals are kept separate; automatic currency conversion is not performed.
- Integrity checks cover account, transaction, transfer, and goal data during loading and restoration.

---

*Neo Finance — NLXV Independent Digital Laboratory*
