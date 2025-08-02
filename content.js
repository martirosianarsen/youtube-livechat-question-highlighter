// == Content Script ==

const seenMessages = new Set()
const MAX_SEEN = 500
const storageKey = 'highlightedQuestions'

// Add highlight style
const style = document.createElement('style')
style.textContent = `
  .question-highlight {
    background-color: rgb(255, 216, 100) !important;
    border-left: 4px solid #ff9800 !important;
    padding-left: 6px !important;
  }
`
document.head.appendChild(style)

function isQuestion(text) {
  if (!text || typeof text !== 'string') return false
  
  // Enhanced question detection
  const trimmed = text.trim()
  
  // Check for question marks (including Armenian)
  if (/[?՞]/.test(trimmed)) return true
  
  // Check for common question words at the beginning
  const questionStarters = /^(what|how|why|when|where|who|which|can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\s+/i
  if (questionStarters.test(trimmed)) return true
  
  return false
}

function getMessageKey(msg) {
  try {
    const id = msg.getAttribute('id')
    if (id) return id
    
    const text = msg.innerText || msg.textContent || ''
    return text.slice(0, 100) + '_' + Date.now()
  } catch (error) {
    console.error('Error getting message key:', error)
    return 'fallback_' + Date.now()
  }
}

function saveQuestion(text) {
  if (!text || text.length > 1000) return // Skip very long messages
  
  chrome.storage.local.get({ [storageKey]: [] }, result => {
    if (chrome.runtime.lastError) {
      console.error('Error loading questions for save:', chrome.runtime.lastError)
      return
    }
    
    const questions = result[storageKey]
    
    // Check if question already exists (handle both string and object formats)
    const questionExists = questions.some(q => {
      const existingText = typeof q === 'string' ? q : q.text
      return existingText === text
    })
    
    if (!questionExists) {
      // Add as object with metadata
      const questionData = {
        text: text,
        timestamp: Date.now(),
        isRead: false,
        url: window.location.href
      }
      
      questions.push(questionData)
      
      // Keep only the most recent 100 questions
      if (questions.length > 100) {
        questions.shift()
      }
      
      chrome.storage.local.set({ [storageKey]: questions }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving question:', chrome.runtime.lastError)
        }
      })
    }
  })
}

function highlightQuestions() {
  try {
    // More comprehensive selectors for different chat platforms
    const messageSelectors = [
      '#chat #message',
      'yt-live-chat-text-message-renderer',
      '.chat-message',
      '[data-testid="message"]',
      '.message-content',
      '.chat-line__message'
    ].join(', ')
    
    const messages = document.querySelectorAll(messageSelectors)

    messages.forEach(msg => {
      try {
        const text = (msg.innerText || msg.textContent || '').trim()
        const key = getMessageKey(msg)

        // Skip if no text, already seen, or already highlighted
        if (!text || seenMessages.has(key) || msg.classList.contains('question-highlight')) {
          return
        }

        if (isQuestion(text)) {
          msg.classList.add('question-highlight')
          seenMessages.add(key)

          // Manage seenMessages size
          if (seenMessages.size > MAX_SEEN) {
            const oldestKey = seenMessages.values().next().value
            seenMessages.delete(oldestKey)
          }

          saveQuestion(text)

          // Send message to extension (with error handling)
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
              type: 'new-question', 
              question: text,
              url: window.location.href,
              timestamp: Date.now()
            }, response => {
              // Handle potential errors silently
              if (chrome.runtime.lastError) {
                // Extension might not be listening, which is okay
              }
            })
          }
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })
  } catch (error) {
    console.error('Error in highlightQuestions:', error)
  }
}

// Debounce function to prevent excessive calls
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Create debounced version of highlightQuestions
const debouncedHighlight = debounce(highlightQuestions, 100)

// Set up mutation observer with error handling
let observer
try {
  observer = new MutationObserver((mutations) => {
    // Only run if there are actual changes to chat messages
    const hasRelevantChanges = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        return node.nodeType === Node.ELEMENT_NODE && 
               (node.matches && (
                 node.matches('#chat #message, yt-live-chat-text-message-renderer, .chat-message, [data-testid="message"], .message-content, .chat-line__message') ||
                 node.querySelector('#chat #message, yt-live-chat-text-message-renderer, .chat-message, [data-testid="message"], .message-content, .chat-line__message')
               ))
      })
    })
    
    if (hasRelevantChanges) {
      debouncedHighlight()
    }
  })

  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false, // Don't watch attribute changes
    characterData: false // Don't watch text changes
  })
} catch (error) {
  console.error('Error setting up mutation observer:', error)
}

// Initial highlight after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', highlightQuestions)
} else {
  highlightQuestions()
}

// Also run after a short delay to catch dynamically loaded content
setTimeout(highlightQuestions, 1000)

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect()
  }
})