document.addEventListener('DOMContentLoaded', () => {
  const questionsEl = document.getElementById('questions')
  const clearBtn = document.getElementById('clearBtn')
  const storageKey = 'highlightedQuestions'

  // Load and display all questions
  function loadQuestions () {
    chrome.storage.local.get({ [storageKey]: [] }, result => {
      if (chrome.runtime.lastError) {
        console.error('Error loading questions:', chrome.runtime.lastError)
        return
      }

      const questions = result[storageKey].reverse()
      questionsEl.innerHTML = '' // Clear existing questions
      questions.forEach(questionData => {
        addQuestionToDOM(questionData, questions)
      })
    })
  }

  // Save questions array to storage
  function saveQuestions (questions) {
    chrome.storage.local.set({ [storageKey]: questions }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving questions:', chrome.runtime.lastError)
      }
    })
  }

  // Add question to DOM with event handlers
  function addQuestionToDOM (questionData, questionsArray) {
    // Handle both string and object formats for backward compatibility
    const text =
      typeof questionData === 'string' ? questionData : questionData.text
    const isRead =
      typeof questionData === 'object' ? questionData.isRead : false
    const timestamp =
      typeof questionData === 'object' ? questionData.timestamp : null
    const url = typeof questionData === 'object' ? questionData.url : null

    const wrapper = document.createElement('div')
    wrapper.className = 'question'
    wrapper.setAttribute('role', 'listitem')

    // Create question content container
    const contentDiv = document.createElement('div')
    contentDiv.className = 'question-content'
    contentDiv.setAttribute('tabindex', '0')
    contentDiv.setAttribute('role', 'button')
    contentDiv.setAttribute('aria-label', `Toggle read status for: ${text}`)

    if (isRead) {
      contentDiv.classList.add('read')
    }

    // Create question text
    const textDiv = document.createElement('div')
    textDiv.className = 'question-text'
    textDiv.textContent = text

    // Create metadata
    const metaDiv = document.createElement('div')
    metaDiv.className = 'question-meta'

    if (timestamp) {
      const timeSpan = document.createElement('span')
      const date = new Date(timestamp)
      timeSpan.textContent = date.toLocaleTimeString('hy-AM', {
        hour: '2-digit',
        minute: '2-digit'
      })
      metaDiv.appendChild(timeSpan)
    }

    if (url) {
      const urlSpan = document.createElement('span')
      try {
        const domain = new URL(url).hostname
        urlSpan.textContent = domain
      } catch {
        urlSpan.textContent = 'Unknown source'
      }
      metaDiv.appendChild(urlSpan)
    }

    contentDiv.appendChild(textDiv)
    if (metaDiv.children.length > 0) {
      contentDiv.appendChild(metaDiv)
    }

    // Add click handler to content div
    contentDiv.addEventListener('click', () => {
      contentDiv.classList.toggle('read')

      // Update storage with read state
      chrome.storage.local.get({ [storageKey]: [] }, result => {
        if (chrome.runtime.lastError) {
          console.error(
            'Error getting questions for read toggle:',
            chrome.runtime.lastError
          )
          return
        }

        const questions = result[storageKey]
        const questionIndex = questions.findIndex(q => {
          const qText = typeof q === 'string' ? q : q.text
          return qText === text
        })

        if (questionIndex > -1) {
          // Convert to object format if needed and update read state
          const wasRead = contentDiv.classList.contains('read')
          questions[questionIndex] = {
            text: text,
            isRead: wasRead,
            timestamp: questions[questionIndex].timestamp || timestamp,
            url: questions[questionIndex].url || url
          }
          saveQuestions(questions)
        }
      })
    })

    // Add keyboard support
    contentDiv.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        contentDiv.click()
      }
    })

    // Create actions container
    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'question-actions'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-btn'
    deleteBtn.textContent = '❌'
    deleteBtn.setAttribute('aria-label', `Delete question: ${text}`)
    deleteBtn.setAttribute('title', 'Delete question')

    deleteBtn.addEventListener('click', e => {
      e.stopPropagation() // Prevent triggering the read toggle

      // Get fresh data from storage to ensure consistency
      chrome.storage.local.get({ [storageKey]: [] }, result => {
        if (chrome.runtime.lastError) {
          console.error(
            'Error getting questions for deletion:',
            chrome.runtime.lastError
          )
          return
        }

        const questions = result[storageKey]
        const questionIndex = questions.findIndex(q => {
          const qText = typeof q === 'string' ? q : q.text
          return qText === text
        })

        if (questionIndex > -1) {
          questions.splice(questionIndex, 1)
          saveQuestions(questions)
          wrapper.remove()
        }
      })
    })

    actionsDiv.appendChild(deleteBtn)
    wrapper.appendChild(contentDiv)
    wrapper.appendChild(actionsDiv)
    questionsEl.appendChild(wrapper)
  }

  // Set up clear button
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(storageKey, () => {
      if (chrome.runtime.lastError) {
        console.error('Error clearing questions:', chrome.runtime.lastError)
        return
      }
      questionsEl.innerHTML = ''
    })
  })

  // Initialize the interface
  loadQuestions()

  // Optional: Listen for storage changes from other parts of the extension
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[storageKey]) {
      loadQuestions() // Reload questions if they changed elsewhere
    }
  })
})
