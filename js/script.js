;(function () {
  /* ======= DECLARATIONS ======= */
  const MINIMUM_WORDS_PER_POST = 750
  const MonthsWith31Days = [0, 2, 4, 6, 7, 9, 11]
  const MonthsWith30Days = [3, 5, 8, 10]

  const DISPLAY_USERS_MENU_TOGGLER_ELEMENT =
      document.querySelector('#display-users'),
    USER_IMAGE_ELEMENT = document.querySelector('img'),
    USER_NAME_ELEMENT = document.querySelector('#user-name'),
    MENU_USERS_ELEMENT = document.querySelector('div[role="menu"]'),
    MENU_USERS_CONTAINER_ELEMENT = MENU_USERS_ELEMENT.querySelector('ul'),
    POST_TITLE_ELEMENT = document.querySelector('main input'),
    PREV_MONTH_ELEMENT = document.querySelector('#prev-month'),
    CURR_MONTH_ELEMENT = document.querySelector('#curr-month'),
    NEXT_MONTH_ELEMENT = document.querySelector('#next-month'),
    POSTS_HISTORY_CONTAINER_ELEMENT = document.querySelector('ul'),
    POST_CONTENT_ELEMENT = document.querySelector('main textarea'),
    WORD_COUNT_ELEMENT = document.querySelector('footer span'),
    TIME_LEFT_ELEMENT = document.querySelector('footer span:last-child')

  let users = [],
    currentPost = null,
    currentUser = localStorage.getItem('currentUser') || 'Bret',
    selectedYear = new Date().getFullYear(),
    selectedMonth = new Date().getMonth(),
    selectedDay = new Date().getDate();

  /* ======= DECLARATIONS: INDEXED DB - FETCH USERS ======= */
  const indexedDB =
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB ||
      window.shimIndexedDB,
    openRequest = indexedDB.open('BukowskiDB', 1)
  let db // variable para almacenar la base de datos

  openRequest.onerror = function () {
    console.error('DB Error', openRequest.error)
  }

  openRequest.onupgradeneeded = async function () {
    db = openRequest.result
    let store = db.createObjectStore('posts', { keyPath: 'id' })
    store.createIndex('date_range', 'date')
    await initializeUsers()
    await loadUserPosts()
  }
  openRequest.onsuccess = async function () {
    db = openRequest.result

    await initializeUsers()
    displayUsers()
  }

  const putPost = (post) => {
    let tx = db.transaction('posts', 'readwrite')
    let store = tx.objectStore('posts')
    const put = store.put(post)

    return new Promise((resolve, reject) => {
      put.onsuccess = function () {
        resolve(put.result)
      }
      put.onerror = function () {
        reject(put.error)
      }
    })
  }

  const getMonthlyPostsByUser = (user, month, year) => {
    let tx = db.transaction('posts', 'readonly'),
      store = tx.objectStore('posts'),
      index = store.index('date_range'),
      firstDayMonth = dateFormatter(new Date(year, month, 1)),
      lastDayMonth = dateFormatter(new Date(year, month + 1, 0)),
      range = IDBKeyRange.bound(firstDayMonth, lastDayMonth),
      cursor = index.openCursor(range)

    return new Promise((resolve, reject) => {
      let userPosts = []
      cursor.onsuccess = function () {
        if (cursor.result) {
          let post = cursor.result.value
          if (post.user === user) userPosts.push(post)
          cursor.result.continue()
        } else {
          resolve(userPosts)
        }
      }
      cursor.onerror = function () {
        reject(cursor.error)
      }
    })
  }

  async function initializeUsers() {
    users = await fetch('https://jsonplaceholder.typicode.com/users')
      .then((response) => response.json())
      .catch((error) => console.error('Error fetching users', error))
  }

  async function loadUserPosts() {
    fetch('../data/initial-posts.json')
      .then((res) => res.json())
      .then((posts) => {
        posts.forEach((post) =>
          putPost({
            id: crypto.randomUUID(),
            ...post
          })
        )
      })
      .catch((error) => console.error('Error fetching initial posts', error))
  }

  /* ======= HEADER LOGIC - PROFILE USERS ======= */
  function displayUsers() {
    MENU_USERS_CONTAINER_ELEMENT.replaceChildren() // clear menu
    users.forEach((user) => {
      const li = document.createElement('li')
      li.addEventListener('click', () => {
        displayCurrentUser(user)
      })

      const img = document.createElement('img')
      img.src = `./img/${user.username}.svg`
      const pName = document.createElement('p')
      pName.textContent = user.name
      li.appendChild(img)
      li.appendChild(pName)
      MENU_USERS_CONTAINER_ELEMENT.appendChild(li)
    })

    displayCurrentUser(users.find((user) => user.username === currentUser))
  }

  function displayCurrentUser(user) {
    USER_IMAGE_ELEMENT.src = `./img/${user.username}.svg`
    USER_NAME_ELEMENT.textContent = user.name
    currentUser = user.username
    localStorage.setItem('currentUser', currentUser)
    MENU_USERS_ELEMENT.classList.add('hidden')

    displayPosts(selectedDay)
  }

  DISPLAY_USERS_MENU_TOGGLER_ELEMENT.addEventListener('click', () => {
    MENU_USERS_ELEMENT.classList.toggle('hidden')
  })

  CURR_MONTH_ELEMENT.addEventListener('click', (e) => {
    e.preventDefault()
  })

  PREV_MONTH_ELEMENT.addEventListener('click', (e) => {
    e.preventDefault()
    selectedMonth--
    if (selectedMonth < 0) {
      selectedMonth = 11
      selectedYear--
    }
    PREV_MONTH_ELEMENT.innerHTML =
      '&blacktriangleleft;' +
      getMonthShortName(new Date(selectedYear, selectedMonth - 1, 1))
    CURR_MONTH_ELEMENT.textContent = getMonthShortName(
      new Date(selectedYear, selectedMonth, 1)
    )
    NEXT_MONTH_ELEMENT.innerHTML =
      getMonthShortName(new Date(selectedYear, selectedMonth + 1, 1)) +
      '&blacktriangleright;'

    POST_CONTENT_ELEMENT.textContent = ''
    displayPosts()
  })

  NEXT_MONTH_ELEMENT.addEventListener('click', (e) => {
    e.preventDefault()
    selectedMonth++
    if (selectedMonth > 11) {
      selectedMonth = 0
      selectedYear++
    }
    PREV_MONTH_ELEMENT.innerHTML =
      '&blacktriangleleft;' +
      getMonthShortName(new Date(selectedYear, selectedMonth - 1, 1))
    CURR_MONTH_ELEMENT.textContent = getMonthShortName(
      new Date(selectedYear, selectedMonth, 1)
    )
    NEXT_MONTH_ELEMENT.innerHTML =
      getMonthShortName(new Date(selectedYear, selectedMonth + 1, 1)) +
      '&blacktriangleright;'

    POST_CONTENT_ELEMENT.textContent = ''
    displayPosts()
  })

  /* ======= POST HISTORY RECORD ======= */
  async function displayPosts() {
    let posts =
      (await getMonthlyPostsByUser(currentUser, selectedMonth, selectedYear)) ||
      []
    let daysInSelectedMonth = 28

    if (MonthsWith31Days.includes(selectedMonth)) daysInSelectedMonth = 31
    else if (MonthsWith30Days.includes(selectedMonth)) daysInSelectedMonth = 30

    currentPost = null
    POST_TITLE_ELEMENT.value = defaultPostTitle(
      dateFormatter(new Date(selectedYear, selectedMonth, selectedDay))
    )
    POST_TITLE_ELEMENT.readOnly = true
    POST_CONTENT_ELEMENT.value = ''
    POST_CONTENT_ELEMENT.readOnly = true
    POST_CONTENT_ELEMENT.scrollTo(0, 0)
    WORD_COUNT_ELEMENT.textContent = 0

    POSTS_HISTORY_CONTAINER_ELEMENT.replaceChildren() // clear posts history
    for (let i = 1; i <= daysInSelectedMonth; i++) {
      const li = document.createElement('li')
      li.dataset.count = 0
      li.dataset.date = dateFormatter(
        new Date(new Date().getFullYear(), selectedMonth, i)
      )

      let postFromDate = posts.find((post) => post.date === li.dataset.date)

      if (postFromDate) {
        li.dataset.count = postFromDate.count
        li.dataset.date = postFromDate.date

        if (postFromDate.count > MINIMUM_WORDS_PER_POST)
          li.classList.add('complete')
        else if (postFromDate.count > 0) li.classList.add('incomplete')
      }

      const isToday = li.dataset.date === dateFormatter(new Date())
      if (isToday) {
        li.classList.add('today')
        currentPost = postFromDate
      }

      if (selectedDay === i && postFromDate) {
        POST_TITLE_ELEMENT.value = postFromDate.title
        POST_CONTENT_ELEMENT.value = postFromDate.text
        WORD_COUNT_ELEMENT.textContent = postFromDate.count
      }

      li.addEventListener('click', () => {
        const day = li.dataset.date.split('-')[2]
        selectedDay = parseInt(day)
        displayPosts()
      })

      POSTS_HISTORY_CONTAINER_ELEMENT.appendChild(li)
    }

    const selectedDate = new Date(selectedYear, selectedMonth, selectedDay)
    const isToday = selectedDate.toDateString() === new Date().toDateString()
    if (isToday) {
      POST_TITLE_ELEMENT.readOnly = false
      POST_CONTENT_ELEMENT.readOnly = false
      POST_CONTENT_ELEMENT.focus()
    }
  }

  /* ======= DAILY POST ======= */
  POST_CONTENT_ELEMENT.addEventListener('keyup', () => {
    WORD_COUNT_ELEMENT.textContent = countWords(POST_CONTENT_ELEMENT.value)
    debounce(savePost)(POST_CONTENT_ELEMENT.value)
  })
  POST_TITLE_ELEMENT.addEventListener('keyup', () => {
    debounce(savePost)()
  })

  async function savePost() {
    const post = {
      id: currentPost?.id || crypto.randomUUID(),
      user: currentUser,
      date: dateFormatter(new Date()),
      title: POST_TITLE_ELEMENT.value,
      text: POST_CONTENT_ELEMENT.value,
      count: countWords(POST_CONTENT_ELEMENT.value)
    }
    await putPost(post)
  }

  /* ======= FOOTER LOGIC - COUNTER & TIMER ======= */

  function displayRemainingTime() {
    const nextDay = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate() + 1
    )
    const remainingTime = nextDay - new Date()
    const remainingTimeFormatted = new Date(remainingTime).toLocaleTimeString(
      'es-UY',
      { hour12: false, timeZone: 'UTC' }
    )
    TIME_LEFT_ELEMENT.textContent = remainingTimeFormatted
  }
  setInterval(displayRemainingTime, 1000)

  /* ======= UTILITY ======= */
  function debounce(callback, wait = 0) {
    let timerId
    return (...args) => {
      clearTimeout(timerId)
      timerId = setTimeout(() => {
        callback(...args)
      }, wait)
    }
  }
  function countWords(words) {
    return words.split(' ').filter((word) => word !== '').length
  }
  function dateFormatter(date) {
    return date.toISOString().split('T')[0]
  }
  function defaultPostTitle(date) {
    // date is going to be a string with format 'YYYY-MM-DD'
    // i want to return a string with the format "{nombre del dia con primera letra mayuscula}, {dia} de {nombre del mes con primera letra mayuscula}, {año}"
    const [year, month, day] = date.split('-')
    const dateObject = new Date(year, month - 1, day)
    const dayName = dateObject.toLocaleDateString('es-UY', {
      weekday: 'long'
    })
    const monthName = dateObject.toLocaleDateString('es-UY', {
      month: 'long'
    })
    return `${dayName[0].toUpperCase()}${dayName.slice(
      1
    )}, ${day} de ${monthName[0].toUpperCase()}${monthName.slice(1)}, ${year}`
  }
  function getMonthShortName(date) {
    return date
      .toLocaleDateString('es-UY', {
        month: 'short'
      })
      .replace('.', '')
  }
})()
