// ============================================
// ESE Study Tracker - Main Application
// With Pagination, Subject Preview & JSON Backend
// ============================================

// Pagination Config
const ITEMS_PER_PAGE = 6;

// Global Data (loaded from JSON or data.js)
let SUBJECTS_DATA_LOADED = [];
let COURSE_CONFIG_LOADED = {};
let CATEGORY_COLORS_LOADED = {};

// State Management
let state = {
    progress: {}, // { subjectId: { completed: 0, totalLectures: X } }
    settings: {
        startDate: '2025-11-17',
        endDate: '2026-12-30'
    },
    currentFilter: 'all',
    selectedChipSubject: null,
    searchQuery: '',
    currentPage: 1,
    currentSelectIndex: 0
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSubjectsData(); // Load subjects first
    await loadStateFromJSON();
    initializeProgress();
    updateCurrentDate();
    renderTodaySummary();
    renderSubjectChips();
    renderSubjectSelect();
    renderSubjectsGrid();
    renderSettingsConfig();
    renderTodaySchedule();
    updateOverviewStats();
    updateProgressRing();
    updateSubjectPreview();
});

// Load Subjects from JSON (with fallback to data.js)
async function loadSubjectsData() {
    try {
        const response = await fetch('subjects.json');
        if (response.ok) {
            const data = await response.json();
            SUBJECTS_DATA_LOADED = data.subjects || [];
            COURSE_CONFIG_LOADED = data.courseConfig || {};
            CATEGORY_COLORS_LOADED = data.categoryColors || {};
            console.log('✅ Loaded subjects from subjects.json');
        } else {
            throw new Error('JSON not found');
        }
    } catch (error) {
        console.log('⚠️ subjects.json not available, using data.js fallback');
        // Fallback to data.js globals
        SUBJECTS_DATA_LOADED = typeof SUBJECTS_DATA !== 'undefined' ? SUBJECTS_DATA : [];
        COURSE_CONFIG_LOADED = typeof COURSE_CONFIG !== 'undefined' ? COURSE_CONFIG : {};
        CATEGORY_COLORS_LOADED = typeof CATEGORY_COLORS !== 'undefined' ? CATEGORY_COLORS : {};
    }

    // Update state settings with loaded config
    if (COURSE_CONFIG_LOADED.startDate) {
        state.settings.startDate = COURSE_CONFIG_LOADED.startDate;
    }
    if (COURSE_CONFIG_LOADED.endDate) {
        state.settings.endDate = COURSE_CONFIG_LOADED.endDate;
    }
}

// Helper to get subjects (use loaded data)
function getSubjects() {
    return SUBJECTS_DATA_LOADED;
}

function getCourseConfig() {
    return COURSE_CONFIG_LOADED;
}

function getCategoryColors() {
    return CATEGORY_COLORS_LOADED;
}

// ============================================
// JSON Backend Functions
// ============================================
async function loadStateFromJSON() {
    try {
        const response = await fetch('progress.json');
        if (response.ok) {
            const data = await response.json();
            if (data.progress && Object.keys(data.progress).length > 0) {
                state.progress = data.progress;
                state.settings = data.settings || state.settings;
            }
        }
    } catch (error) {
        console.log('JSON file not found, using localStorage');
    }

    const savedState = localStorage.getItem('eseStudyTrackerState');
    if (savedState && Object.keys(state.progress).length === 0) {
        const parsed = JSON.parse(savedState);
        state.progress = parsed.progress || {};
        state.settings = parsed.settings || state.settings;
    }
}

function saveState() {
    localStorage.setItem('eseStudyTrackerState', JSON.stringify({
        progress: state.progress,
        settings: state.settings
    }));
    updateDownloadableJSON();
}

function updateDownloadableJSON() {
    const data = {
        progress: state.progress,
        settings: state.settings,
        lastUpdated: new Date().toISOString()
    };
    sessionStorage.setItem('progressJSON', JSON.stringify(data, null, 2));
}

function initializeProgress() {
    getSubjects().forEach(subject => {
        if (!state.progress[subject.id]) {
            state.progress[subject.id] = {
                completed: 0,
                totalLectures: subject.totalLectures
            };
        } else {
            state.progress[subject.id].totalLectures = subject.totalLectures;
        }
    });
    saveState();
}

// ============================================
// Date Utilities
// ============================================
function updateCurrentDate() {
    const now = new Date();
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-IN', options);

    const startDate = new Date(state.settings.startDate);
    const dayNumber = Math.floor((now - startDate) / (1000 * 60 * 60 * 24)) + 1;
    document.getElementById('dayNumber').textContent = `Day ${Math.max(1, dayNumber)}`;
}

function getSubjectStatus(subject) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const startDate = new Date(subject.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(subject.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (now < startDate) return 'upcoming';
    if (now > endDate) return 'completed';
    return 'active';
}

function getDaysRemaining(endDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
}

// Calculate total days between startDate and endDate
function getTotalDays(startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(1, diffDays); // At least 1 day
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateDailyTarget(subject, progress) {
    const totalDays = subject.durationDays || getTotalDays(subject.startDate, subject.endDate);
    const daysRemaining = getDaysRemaining(subject.endDate);
    const remainingLectures = progress.totalLectures - progress.completed;

    // User Rule: 
    // If durationDays >= daysRemaining (Active/Crunch), use remaining/remaining
    // If durationDays < daysRemaining (Future), use total/duration
    if (totalDays >= daysRemaining) {
        return remainingLectures / Math.max(1, daysRemaining);
    } else {
        return progress.totalLectures / Math.max(1, totalDays);
    }
}

// ============================================
// Today Summary Section
// ============================================
// Remove old independent summary render to avoid errors
function renderTodaySummary() {
    // Legacy function support - redirect to updateOverviewStats can be done here if needed
    // But since we merged the UI, we just rely on updateOverviewStats
    updateOverviewStats();
}

// ============================================
// Subject Preview Panel
// ============================================
function updateSubjectPreview() {
    const container = document.getElementById('subjectPreview');
    if (!container) return;

    const subjectId = state.selectedChipSubject || document.getElementById('subjectSelect')?.value;

    if (!subjectId) {
        container.innerHTML = `
            <div class="preview-placeholder">
                <span class="preview-icon">👆</span>
                <span class="preview-text">Subject বাছুন details দেখতে</span>
            </div>
        `;
        return;
    }

    const subject = getSubjects().find(s => s.id === subjectId);
    if (!subject) return;

    const progress = state.progress[subjectId] || { completed: 0, totalLectures: subject.totalLectures };
    const percentage = progress.totalLectures > 0
        ? Math.round((progress.completed / progress.totalLectures) * 100)
        : 0;
    const daysRemaining = getDaysRemaining(subject.endDate);
    const remainingLectures = progress.totalLectures - progress.completed;

    // Use durationDays from JSON if available, otherwise calculate
    const totalDays = subject.durationDays || getTotalDays(subject.startDate, subject.endDate);
    const lecturesPerDay = calculateDailyTarget(subject, progress).toFixed(1);
    const status = getSubjectStatus(subject);

    container.innerHTML = `
        <div class="subject-preview-content">
            <div class="preview-stat">
                <span class="preview-stat-label">Subject</span>
                <span class="preview-stat-value">${subject.name}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">Status</span>
                <span class="preview-stat-value ${status}">${getStatusLabel(status)}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">মোট দিন</span>
                <span class="preview-stat-value">${totalDays}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">বাকি দিন</span>
                <span class="preview-stat-value highlight">${daysRemaining}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">End Date</span>
                <span class="preview-stat-value">${formatDate(subject.endDate)}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">সম্পূর্ণ</span>
                <span class="preview-stat-value">${progress.completed} / ${progress.totalLectures}</span>
            </div>
            <div class="preview-stat">
                <span class="preview-stat-label">প্রতিদিন</span>
                <span class="preview-stat-value highlight">${lecturesPerDay}</span>
            </div>
            <div class="preview-progress">
                <div class="preview-progress-bar">
                    <div class="preview-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="preview-progress-text">
                    <span>${percentage}% complete</span>
                    <span>${remainingLectures} বাকি</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// Subject Chips
// ============================================
function renderSubjectChips() {
    const container = document.getElementById('subjectChips');
    if (!container) return;

    container.innerHTML = '';

    const activeSubjects = getSubjects().filter(s => getSubjectStatus(s) === 'active');
    const otherSubjects = getSubjects().filter(s => getSubjectStatus(s) !== 'active');
    const orderedSubjects = [...activeSubjects, ...otherSubjects];

    orderedSubjects.forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };
        const percentage = progress.totalLectures > 0
            ? Math.round((progress.completed / progress.totalLectures) * 100)
            : 0;
        const status = getSubjectStatus(subject);

        const chip = document.createElement('button');
        chip.className = `subject-chip ${state.selectedChipSubject === subject.id ? 'selected' : ''}`;
        chip.dataset.subjectId = subject.id;
        chip.innerHTML = `
            ${subject.name}
            <span class="chip-progress">${percentage}%</span>
        `;
        chip.onclick = () => selectChipSubject(subject.id);

        if (status === 'active') {
            chip.style.borderLeft = '3px solid #10b981';
        }

        container.appendChild(chip);
    });
}

function selectChipSubject(subjectId) {
    if (state.selectedChipSubject === subjectId) {
        state.selectedChipSubject = null;
    } else {
        state.selectedChipSubject = subjectId;
    }

    document.querySelectorAll('.subject-chip').forEach(chip => {
        if (chip.dataset.subjectId === subjectId && state.selectedChipSubject === subjectId) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });

    const select = document.getElementById('subjectSelect');
    if (state.selectedChipSubject) {
        select.value = state.selectedChipSubject;
    } else {
        select.value = '';
    }

    // Update preview when selection changes
    updateSubjectPreview();
}

// ============================================
// Select Scroll Functions
// ============================================
function scrollSelectLeft() {
    const select = document.getElementById('subjectSelect');
    if (select.selectedIndex > 0) {
        select.selectedIndex--;
        state.selectedChipSubject = select.value || null;
        renderSubjectChips();
        updateSubjectPreview();
    }
}

function scrollSelectRight() {
    const select = document.getElementById('subjectSelect');
    if (select.selectedIndex < select.options.length - 1) {
        select.selectedIndex++;
        state.selectedChipSubject = select.value || null;
        renderSubjectChips();
        updateSubjectPreview();
    }
}

// ============================================
// Search Functions
// ============================================
function searchSubjects() {
    const searchInput = document.getElementById('subjectSearch');
    if (!searchInput) return;

    state.searchQuery = searchInput.value.toLowerCase().trim();
    state.currentPage = 1;
    renderSubjectsGrid();
}

function searchSettingsSubjects() {
    const searchInput = document.getElementById('settingsSubjectSearch');
    if (!searchInput) return;

    const query = searchInput.value.toLowerCase().trim();

    document.querySelectorAll('.config-item').forEach(item => {
        const name = item.querySelector('.config-item-name').textContent.toLowerCase();
        if (name.includes(query) || query === '') {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================
// Render Functions
// ============================================
function renderSubjectSelect() {
    const select = document.getElementById('subjectSelect');
    const activeSubjects = getSubjects().filter(s => getSubjectStatus(s) === 'active');

    select.innerHTML = '<option value="">-- Select --</option>';

    if (activeSubjects.length > 0) {
        const activeGroup = document.createElement('optgroup');
        activeGroup.label = '📍 চলছে';
        activeSubjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            activeGroup.appendChild(option);
        });
        select.appendChild(activeGroup);
    }

    const allGroup = document.createElement('optgroup');
    allGroup.label = '📚 সব';
    getSubjects().forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        allGroup.appendChild(option);
    });
    select.appendChild(allGroup);

    select.onchange = () => {
        state.selectedChipSubject = select.value || null;
        renderSubjectChips();
        updateSubjectPreview();
    };
}

function getFilteredSubjects() {
    return getSubjects().filter(subject => {
        if (state.currentFilter !== 'all' && getSubjectStatus(subject) !== state.currentFilter) {
            return false;
        }
        if (state.searchQuery && !subject.name.toLowerCase().includes(state.searchQuery)) {
            return false;
        }
        return true;
    });
}

function renderSubjectsGrid() {
    const grid = document.getElementById('subjectsGrid');
    grid.innerHTML = '';

    const filteredSubjects = getFilteredSubjects();
    const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);

    if (state.currentPage > totalPages) {
        state.currentPage = Math.max(1, totalPages);
    }

    const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageSubjects = filteredSubjects.slice(startIndex, endIndex);

    if (pageSubjects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-text">কোনো subject পাওয়া যায়নি</p>
            </div>
        `;
        renderPagination(0, 0);
        return;
    }

    pageSubjects.forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };
        const status = getSubjectStatus(subject);
        const percentage = progress.totalLectures > 0
            ? Math.round((progress.completed / progress.totalLectures) * 100)
            : 0;

        const daysRemaining = getDaysRemaining(subject.endDate);
        const remainingLectures = progress.totalLectures - progress.completed;
        // Use durationDays from JSON for per-day calculation
        const totalDays = subject.durationDays || getTotalDays(subject.startDate, subject.endDate);
        const lecturesPerDay = calculateDailyTarget(subject, progress).toFixed(1);

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-card-header">
                <span class="subject-name">${subject.name}</span>
                <span class="subject-status ${status}">${getStatusLabel(status)}</span>
            </div>
            <div class="subject-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-stats">
                    <span class="progress-completed">${progress.completed} / ${progress.totalLectures}</span>
                    <span class="progress-remaining">${percentage}%</span>
                </div>
            </div>
            <div class="subject-meta">
                <div class="meta-item">
                    <span class="meta-label">বাকি</span>
                    <span class="meta-value">${daysRemaining} দিন</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">প্রতিদিন</span>
                    <span class="meta-value">${lecturesPerDay}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${totalDays} দিন</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">End</span>
                    <span class="meta-value">${formatDate(subject.endDate)}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    renderPagination(totalPages, filteredSubjects.length);
}

function renderPagination(totalPages, totalItems) {
    const container = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pagination = document.getElementById('pagination');

    if (!container || !pagination) return;

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    container.innerHTML = '';

    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= totalPages;

    const maxVisible = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-num ${i === state.currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }
}

function goToPage(page) {
    state.currentPage = page;
    renderSubjectsGrid();
    document.querySelector('.subjects-section').scrollIntoView({ behavior: 'smooth' });
}

function prevPage() {
    if (state.currentPage > 1) {
        state.currentPage--;
        renderSubjectsGrid();
    }
}

function nextPage() {
    const totalPages = Math.ceil(getFilteredSubjects().length / ITEMS_PER_PAGE);
    if (state.currentPage < totalPages) {
        state.currentPage++;
        renderSubjectsGrid();
    }
}

function renderTodaySchedule() {
    const container = document.getElementById('todaySchedule');
    container.innerHTML = '';

    const activeSubjects = getSubjects().filter(s => getSubjectStatus(s) === 'active');

    if (activeSubjects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <p class="empty-state-text">আজকে কোনো schedule নেই</p>
            </div>
        `;
        return;
    }

    activeSubjects.forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };
        const remaining = progress.totalLectures - progress.completed;
        const daysRemaining = getDaysRemaining(subject.endDate);
        // Use durationDays from JSON if available
        const totalDays = subject.durationDays || getTotalDays(subject.startDate, subject.endDate);
        const lecturesPerDay = calculateDailyTarget(subject, progress).toFixed(1);

        const card = document.createElement('div');
        card.className = 'schedule-card new-lecture';
        card.innerHTML = `
            <div class="schedule-card-header">
                <span class="schedule-card-title">${subject.name}</span>
                <span class="schedule-type-badge new">${lecturesPerDay}/day</span>
            </div>
            <div class="schedule-card-info">
                বাকি: ${remaining} | ${daysRemaining} দিন
            </div>
        `;
        container.appendChild(card);
    });
}

function renderSettingsConfig() {
    const list = document.getElementById('subjectConfigList');
    list.innerHTML = '';

    getSubjects().forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };

        const item = document.createElement('div');
        item.className = 'config-item';
        item.dataset.subjectId = subject.id;
        item.innerHTML = `
            <span class="config-item-name">${subject.name}</span>
            <input type="number" 
                   class="config-input" 
                   data-subject="${subject.id}" 
                   value="${progress.totalLectures}" 
                   min="1"
                   title="Total lectures for ${subject.name}">
        `;
        list.appendChild(item);
    });

    document.getElementById('startDate').value = state.settings.startDate;
    document.getElementById('endDate').value = state.settings.endDate;
}

function updateOverviewStats() {
    let totalToday = 0;
    let totalCompleted = 0;
    let totalRemaining = 0;

    // Calculate stats
    const activeSubjects = getSubjects().filter(s => getSubjectStatus(s) === 'active');

    activeSubjects.forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };
        const remaining = progress.totalLectures - progress.completed;

        const perDay = calculateDailyTarget(subject, progress);

        totalToday += perDay;
        totalCompleted += progress.completed;
        totalRemaining += remaining;
    });

    // Round totalToday up for display
    totalToday = Math.ceil(totalToday);

    // Update Overall Stats
    document.getElementById('todayLectures').textContent = totalToday;
    document.getElementById('completedLectures').textContent = totalCompleted;
    document.getElementById('remainingLectures').textContent = totalRemaining;

    // Update Merged Header Badges/Stats
    const courseDaysRemaining = getDaysRemaining(state.settings.endDate);

    const activeCountEl = document.getElementById('activeSubjectsCount');
    if (activeCountEl) activeCountEl.textContent = activeSubjects.length;

    const daysLeftBadge = document.getElementById('daysLeftBadge');
    if (daysLeftBadge) daysLeftBadge.textContent = `${courseDaysRemaining} দিন বাকি`;
}

function updateProgressRing() {
    let totalCompleted = 0;
    let totalLectures = 0;

    getSubjects().forEach(subject => {
        const progress = state.progress[subject.id] || { completed: 0, totalLectures: subject.totalLectures };
        totalCompleted += progress.completed;
        totalLectures += progress.totalLectures;
    });

    const percentage = totalLectures > 0 ? Math.round((totalCompleted / totalLectures) * 100) : 0;
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percentage / 100) * circumference;

    const ring = document.getElementById('progressRing');
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = `url(#progressGradient)`;

    if (!document.getElementById('progressGradient')) {
        const svg = ring.closest('svg');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1"/>
                <stop offset="50%" stop-color="#8b5cf6"/>
                <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
        `;
        svg.insertBefore(defs, svg.firstChild);
    }

    document.getElementById('overallProgress').textContent = `${percentage}%`;
}

function getStatusLabel(status) {
    switch (status) {
        case 'active': return 'চলছে';
        case 'upcoming': return 'আসছে';
        case 'completed': return 'শেষ';
        default: return status;
    }
}

// ============================================
// Event Handlers
// ============================================
function incrementLecture() {
    const input = document.getElementById('lectureCount');
    input.value = parseInt(input.value) + 1;
}

function decrementLecture() {
    const input = document.getElementById('lectureCount');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

function logProgress() {
    let subjectId = state.selectedChipSubject || document.getElementById('subjectSelect').value;
    const count = parseInt(document.getElementById('lectureCount').value);

    if (!subjectId) {
        showToast('দয়া করে একটি subject বাছুন', 'error');
        return;
    }

    if (!count || count < 1) {
        showToast('Lecture সংখ্যা সঠিক নয়', 'error');
        return;
    }

    const subject = getSubjects().find(s => s.id === subjectId);
    if (!state.progress[subjectId]) {
        state.progress[subjectId] = { completed: 0, totalLectures: subject.totalLectures };
    }

    state.progress[subjectId].completed += count;

    if (state.progress[subjectId].completed > state.progress[subjectId].totalLectures) {
        state.progress[subjectId].completed = state.progress[subjectId].totalLectures;
    }

    saveState();

    // Refresh all UI
    renderTodaySummary();
    renderSubjectChips();
    renderSubjectsGrid();
    renderTodaySchedule();
    updateOverviewStats();
    updateProgressRing();
    updateSubjectPreview();

    showToast(`✅ ${subject.name} - ${count} lectures added!`, 'success');

    // Reset inputs
    state.selectedChipSubject = null;
    document.getElementById('subjectSelect').value = '';
    document.getElementById('lectureCount').value = 1;
    renderSubjectChips();
    updateSubjectPreview();
}

function filterSubjects(filter) {
    state.currentFilter = filter;
    state.currentPage = 1;

    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    renderSubjectsGrid();
}

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    overlay.classList.toggle('active');

    const searchInput = document.getElementById('settingsSubjectSearch');
    if (searchInput) {
        searchInput.value = '';
        searchSettingsSubjects();
    }
}

function closeSettings(event) {
    if (event.target === event.currentTarget) {
        toggleSettings();
    }
}

function saveSettings() {
    // Update lecture counts
    document.querySelectorAll('.config-input[data-subject]').forEach(input => {
        const subjectId = input.dataset.subject;
        const totalLectures = parseInt(input.value) || 0;

        if (state.progress[subjectId]) {
            state.progress[subjectId].totalLectures = totalLectures;
        } else {
            state.progress[subjectId] = { completed: 0, totalLectures };
        }
    });

    // Update dates from settings
    state.settings.startDate = document.getElementById('startDate').value;
    state.settings.endDate = document.getElementById('endDate').value;

    saveState();

    // Refresh all UI
    renderTodaySummary();
    renderSubjectChips();
    renderSubjectsGrid();
    renderTodaySchedule();
    updateOverviewStats();
    updateProgressRing();
    updateCurrentDate();

    toggleSettings();
    showToast('⚙️ Settings saved!', 'success');
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Export/Import Data
// ============================================
function exportData() {
    const data = {
        progress: state.progress,
        settings: state.settings,
        lastUpdated: new Date().toISOString()
    };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ese-study-tracker-progress.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📁 Data exported as JSON!', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            state.progress = data.progress || {};
            state.settings = data.settings || state.settings;
            saveState();
            location.reload();
        } catch (err) {
            showToast('Invalid backup file', 'error');
        }
    };
    reader.readAsText(file);
}
