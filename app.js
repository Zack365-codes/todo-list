/**
 * TaskFlow - Modern To-Do List Application
 * Architecture: Modular ES6+ with Centralized State, Event Delegation,
 * LocalStorage Persistence, and Modern Web Accessibility Standards.
 */

(() => {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEY = 'taskflow_todos_v1';
  const THEME_KEY = 'taskflow_theme_v1';

  // Default seed tasks if storage is empty on first load
  const DEFAULT_TASKS = [
    {
      id: 'task-1',
      text: 'Explore TaskFlow features ✨',
      completed: true,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'task-2',
      text: 'Double click any task to edit inline ✏️',
      completed: false,
      createdAt: Date.now() - 1800000,
    },
    {
      id: 'task-3',
      text: 'Try deleting an item to test the quick undo state ↩️',
      completed: false,
      createdAt: Date.now(),
    },
  ];

  // --- Application State ---
  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'active' | 'completed'
    editingId: null,
    undoState: null, // { action: 'delete' | 'clear', tasks: [...], timerId: null }
  };

  // --- DOM Elements Cache ---
  const elements = {
    form: document.getElementById('todo-form'),
    input: document.getElementById('todo-input'),
    inputError: document.getElementById('input-error'),
    todoList: document.getElementById('todo-list'),
    emptyState: document.getElementById('empty-state'),
    itemsLeft: document.getElementById('items-left'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    themeToggleBtn: document.getElementById('theme-toggle'),
    currentDateLabel: document.getElementById('current-date'),
    undoToast: document.getElementById('undo-toast'),
    toastMessage: document.getElementById('toast-message'),
    undoBtn: document.getElementById('undo-btn'),
    toastCloseBtn: document.getElementById('toast-close-btn'),
    toastProgress: document.getElementById('toast-progress'),
  };

  // --- State Persistence & Initialization ---
  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      state.tasks = stored !== null ? JSON.parse(stored) : DEFAULT_TASKS;
    } catch (err) {
      console.warn('Failed to read from localStorage, using default tasks:', err);
      state.tasks = DEFAULT_TASKS;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (err) {
      console.error('Failed to save tasks to localStorage:', err);
    }
  }

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', initialTheme);

    elements.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem(THEME_KEY, nextTheme);
    });
  }

  // --- Date Subtitle ---
  function initDateDisplay() {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const today = new Date().toLocaleDateString(undefined, options);
    if (elements.currentDateLabel) {
      elements.currentDateLabel.textContent = `${today} • Stay organized`;
    }
  }

  // --- Input Validation & Feedback ---
  function triggerEmptyInputFeedback() {
    elements.input.classList.remove('shake');
    // Force DOM reflow to restart CSS animation
    void elements.input.offsetWidth;
    elements.input.classList.add('shake', 'is-invalid');
    elements.input.setAttribute('aria-invalid', 'true');
    elements.input.focus();

    setTimeout(() => {
      elements.input.classList.remove('shake');
    }, 400);
  }

  function clearInputValidation() {
    elements.input.classList.remove('is-invalid', 'shake');
    elements.input.removeAttribute('aria-invalid');
  }

  // --- Core CRUD Operations ---
  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      triggerEmptyInputFeedback();
      return false;
    }

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    state.tasks.unshift(newTask);
    saveState();
    render();

    // Reset input
    elements.input.value = '';
    clearInputValidation();
    elements.input.focus();
    return true;
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveState();
      render();
    }
  }

  function startEditing(id) {
    state.editingId = id;
    render();

    const input = document.getElementById(`edit-input-${id}`);
    if (input) {
      input.focus();
      // Move cursor to end of text
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }

  function saveEditing(id, newText) {
    const trimmed = newText.trim();
    const task = state.tasks.find((t) => t.id === id);

    if (task) {
      if (trimmed) {
        task.text = trimmed;
      }
      // If empty, leave previous text to prevent accidental empty task
    }

    state.editingId = null;
    saveState();
    render();
  }

  function cancelEditing() {
    state.editingId = null;
    render();
  }

  function deleteTask(id) {
    const taskIndex = state.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) return;

    const [deletedTask] = state.tasks.splice(taskIndex, 1);
    saveState();
    render();

    // Trigger quick undo state
    showUndoToast(`Deleted "${deletedTask.text.length > 20 ? deletedTask.text.slice(0, 20) + '…' : deletedTask.text}"`, () => {
      // Undo callback: restore at previous index
      state.tasks.splice(taskIndex, 0, deletedTask);
      saveState();
      render();
    });
  }

  function clearCompleted() {
    const completedTasks = state.tasks.filter((t) => t.completed);
    if (completedTasks.length === 0) return;

    const previousSnapshot = [...state.tasks];
    state.tasks = state.tasks.filter((t) => !t.completed);
    saveState();
    render();

    showUndoToast(`Cleared ${completedTasks.length} completed ${completedTasks.length === 1 ? 'task' : 'tasks'}`, () => {
      state.tasks = previousSnapshot;
      saveState();
      render();
    });
  }

  // --- Quick Undo Toast Notification System ---
  function showUndoToast(message, onUndo) {
    // Clear any previous timer
    if (state.undoState && state.undoState.timerId) {
      clearTimeout(state.undoState.timerId);
    }

    state.undoState = {
      onUndo,
      timerId: setTimeout(() => {
        hideUndoToast();
      }, 5000),
    };

    elements.toastMessage.textContent = message;
    elements.undoToast.classList.remove('hidden');

    // Reset progress bar animation
    elements.toastProgress.style.animation = 'none';
    void elements.toastProgress.offsetWidth;
    elements.toastProgress.style.animation = 'toastProgress 5s linear forwards';
  }

  function hideUndoToast() {
    if (state.undoState && state.undoState.timerId) {
      clearTimeout(state.undoState.timerId);
    }
    state.undoState = null;
    elements.undoToast.classList.add('hidden');
  }

  // --- Filtering Logic ---
  function getFilteredTasks() {
    switch (state.filter) {
      case 'active':
        return state.tasks.filter((t) => !t.completed);
      case 'completed':
        return state.tasks.filter((t) => t.completed);
      case 'all':
      default:
        return state.tasks;
    }
  }

  function setFilter(filterName) {
    if (state.filter === filterName) return;
    state.filter = filterName;

    elements.filterTabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-filter') === filterName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    render();
  }

  // --- Rendering Functions ---
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderTasks() {
    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
      elements.todoList.innerHTML = '';
      elements.emptyState.classList.remove('hidden');
      return;
    }

    elements.emptyState.classList.add('hidden');

    elements.todoList.innerHTML = filtered
      .map((task) => {
        const isEditing = state.editingId === task.id;
        const escapedText = escapeHTML(task.text);

        return `
          <li class="todo-item ${task.completed ? 'completed' : ''} fade-enter" data-id="${task.id}">
            <label class="checkbox-container">
              <input
                type="checkbox"
                class="todo-checkbox"
                ${task.completed ? 'checked' : ''}
                aria-label="Mark task '${escapedText}' as ${task.completed ? 'active' : 'completed'}"
              />
              <svg class="checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </label>

            ${
              isEditing
                ? `<input
                    type="text"
                    id="edit-input-${task.id}"
                    class="todo-edit-input"
                    value="${escapedText}"
                    maxlength="200"
                    aria-label="Edit task description"
                  />`
                : `<span class="todo-title" title="Double click to edit" tabindex="0" role="button" aria-label="${escapedText}. Double-click or press Enter to edit.">
                    ${escapedText}
                  </span>`
            }

            <div class="item-actions">
              <button
                type="button"
                class="action-btn edit-btn"
                aria-label="Edit task '${escapedText}'"
                title="Edit task"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
              </button>
              <button
                type="button"
                class="action-btn delete-btn"
                aria-label="Delete task '${escapedText}'"
                title="Delete task"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </li>
        `;
      })
      .join('');
  }

  function renderFooter() {
    const activeCount = state.tasks.filter((t) => !t.completed).length;
    const completedCount = state.tasks.filter((t) => t.completed).length;

    // Pluralization
    elements.itemsLeft.textContent = `${activeCount} ${activeCount === 1 ? 'item' : 'items'} left`;

    // Clear completed visibility
    if (completedCount > 0) {
      elements.clearCompletedBtn.classList.remove('hidden');
      elements.clearCompletedBtn.textContent = `Clear Completed (${completedCount})`;
    } else {
      elements.clearCompletedBtn.classList.add('hidden');
    }
  }

  function render() {
    renderTasks();
    renderFooter();
  }

  // --- Event Listeners & Event Delegation ---
  function setupEventListeners() {
    // 1. Form Submission (Add task via Enter or Add Button)
    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      addTask(elements.input.value);
    });

    // 2. Clear error on typing
    elements.input.addEventListener('input', () => {
      if (elements.input.value.trim()) {
        clearInputValidation();
      }
    });

    // 3. Delegated Click and Change Events on Task List
    elements.todoList.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.todo-item');
      if (!itemEl) return;
      const taskId = itemEl.dataset.id;

      // Click on Delete Button
      if (e.target.closest('.delete-btn')) {
        deleteTask(taskId);
        return;
      }

      // Click on Edit Button
      if (e.target.closest('.edit-btn')) {
        startEditing(taskId);
        return;
      }
    });

    // Delegated Double Click on Task Title to inline edit
    elements.todoList.addEventListener('dblclick', (e) => {
      const titleEl = e.target.closest('.todo-title');
      if (!titleEl) return;
      const itemEl = titleEl.closest('.todo-item');
      if (itemEl) {
        startEditing(itemEl.dataset.id);
      }
    });

    // Delegated Change on Checkbox
    elements.todoList.addEventListener('change', (e) => {
      if (e.target.matches('.todo-checkbox')) {
        const itemEl = e.target.closest('.todo-item');
        if (itemEl) {
          toggleTask(itemEl.dataset.id);
        }
      }
    });

    // Keyboard support for Task List items (Enter/Space on title or Escape/Enter on edit-input)
    elements.todoList.addEventListener('keydown', (e) => {
      const itemEl = e.target.closest('.todo-item');
      if (!itemEl) return;
      const taskId = itemEl.dataset.id;

      // Keydown inside inline edit input
      if (e.target.matches('.todo-edit-input')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEditing(taskId, e.target.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditing();
        }
        return;
      }

      // Keydown on task title when focused via Tab
      if (e.target.matches('.todo-title')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEditing(taskId);
        }
      }
    });

    // Blur on inline edit input (auto-save)
    elements.todoList.addEventListener(
      'blur',
      (e) => {
        if (e.target.matches('.todo-edit-input')) {
          const itemEl = e.target.closest('.todo-item');
          if (itemEl && state.editingId === itemEl.dataset.id) {
            saveEditing(itemEl.dataset.id, e.target.value);
          }
        }
      },
      true // capture phase
    );

    // 5. Filter Tabs Click & Keyboard Navigation
    elements.filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        setFilter(tab.getAttribute('data-filter'));
      });
    });

    // 6. Clear Completed Button
    elements.clearCompletedBtn.addEventListener('click', clearCompleted);

    // 7. Quick Undo Toast Actions
    elements.undoBtn.addEventListener('click', () => {
      if (state.undoState && typeof state.undoState.onUndo === 'function') {
        state.undoState.onUndo();
      }
      hideUndoToast();
    });

    elements.toastCloseBtn.addEventListener('click', hideUndoToast);
  }

  // --- App Initialization ---
  function init() {
    initTheme();
    initDateDisplay();
    loadState();
    setupEventListeners();
    render();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

