// Component that places models where the ground or walls are clicked
// Users can place multiple models, select them, move them, scale them, and delete them
// NOW WITH: Wall detection, unlimited zoom, and better plane detection

export const tapPlaceComponent = {
  schema: {
    min: {default: 6},
    max: {default: 10},
  },
  init() {
    this.prompt = document.getElementById('promptText')
    this.models = []  // Array to track all placed models
    this.selectedModel = null  // Currently selected model for editing
    this.selectedModelId = 'model1'  // Default selected model type to place

    // Define your models here
    this.modelTypes = [
      {id: 'model1', name: 'Model 1', scale: 5},
      {id: 'model2', name: 'Model 2', scale: 5},
      {id: 'model3', name: 'Model 3', scale: 10},
      {id: 'model4', name: 'Model 4', scale: 5},
      {id: 'model5', name: 'Model 5', scale: 5},
      {id: 'model6', name: 'Model 6', scale: 5},
      {id: 'model7', name: 'Model 7', scale: 6},
    ]

    this.modelsPerPage = 2
    this.currentPage = 0
    this.totalPages = Math.ceil(this.modelTypes.length / this.modelsPerPage)

    // Touch interaction state
    this.touchStartDistance = 0
    this.initialScale = 1
    this.isDragging = false
    this.dragStartPoint = null
    this.isClickingModel = false

    // Setup UI
    this.setupModelSelector()
    this.setupControlButtons()

    // Setup raycaster for better plane detection
    this.setupRaycaster()

    // Listen for clicks on scene (both ground and walls)
    this.el.sceneEl.addEventListener('click', (event) => {
      this.handleSceneClick(event)
    })

    // Touch event handlers for pinch zoom and drag
    this.setupTouchHandlers()
  },

  setupRaycaster() {
    // Get camera and ensure raycaster is set up properly
    const camera = document.getElementById('camera')
    if (camera) {
      // Update raycaster to detect both ground and xr-planes
      camera.setAttribute('raycaster', {
        objects: '.cantap, .placed-model, [xr-planes]',
        far: 100,
        near: 0,
      })
    }
  },

  handleSceneClick(event) {
    // Nếu đang có model rồi thì không tạo thêm
    if (this.models.length > 0) {
      console.log('Model đã tồn tại, hãy xóa trước khi đặt mới.')
      return
    }

    // Nếu đang kéo model thì không đặt mới
    if (this.isDragging) return

    // Check if we have intersection data
    if (!event.detail || !event.detail.intersection) {
      console.log('No intersection detected')
      return
    }

    const {intersection} = event.detail
    const clickedObject = intersection.object

    // Kiểm tra nếu click trúng model đã đặt thì bỏ qua
    if (clickedObject && clickedObject.el && clickedObject.el.classList.contains('placed-model')) {
      return
    }

    // Get touch point and normal vector
    const touchPoint = intersection.point
    const normal = intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0)

    // Transform normal to world space if needed
    if (clickedObject && clickedObject.matrixWorld) {
      normal.transformDirection(clickedObject.matrixWorld)
    }

    this.prompt.style.display = 'none'

    // Check if this is a vertical surface (wall) or horizontal (ground/ceiling)
    const isVerticalSurface = Math.abs(normal.y) < 0.5
    const isHorizontalSurface = Math.abs(normal.y) > 0.5

    console.log('Surface type:', isVerticalSurface ? 'Wall' : 'Ground/Ceiling')
    console.log('Normal vector:', normal)
    console.log('Touch point:', touchPoint)

    this.placeModel(touchPoint, normal, isVerticalSurface)
  },

  placeModel(position, normal, isVerticalSurface) {
    // Tạo entity mới
    const newElement = document.createElement('a-entity')
    newElement.setAttribute('position', position)

    const selectedModelType = this.modelTypes.find(m => m.id === this.selectedModelId)
    const modelScale = selectedModelType ? selectedModelType.scale : 1

    // Calculate rotation based on surface normal
    let rotation
    if (isVerticalSurface) {
      // For walls: orient model to face outward from wall
      const angle = Math.atan2(normal.x, normal.z) * (180 / Math.PI)
      rotation = `0 ${angle + 180} 0`

      // Adjust position slightly off the wall to prevent z-fighting
      const offset = normal.clone().multiplyScalar(0.1)
      position.add(offset)
      newElement.setAttribute('position', position)
    } else {
      // For ground: orient towards camera
      const camera = document.getElementById('camera')
      const cameraPos = camera.object3D.position
      const direction = new THREE.Vector3()
      direction.subVectors(cameraPos, position)
      direction.y = 0
      direction.normalize()
      const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI)
      rotation = `0 ${angle} 0`
    }

    newElement.setAttribute('rotation', rotation)
    newElement.setAttribute('visible', 'false')
    newElement.setAttribute('scale', '0.0001 0.0001 0.0001')
    newElement.setAttribute('gltf-model', `#${this.selectedModelId}`)
    newElement.classList.add('placed-model')
    newElement.classList.add('cantap')

    newElement.userData = {
      baseScale: modelScale,
      currentScale: modelScale,
      isLocked: false,
      surfaceNormal: normal.clone(),
      isOnWall: isVerticalSurface,
    }

    this.el.sceneEl.appendChild(newElement)
    this.models.push(newElement)

    // Add click handler for selection
    newElement.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      this.selectModel(newElement)
    })

    // Animate model appearance
    newElement.addEventListener('model-loaded', () => {
      newElement.setAttribute('visible', 'true')
      newElement.setAttribute('animation', {
        property: 'scale',
        to: `${modelScale} ${modelScale} ${modelScale}`,
        easing: 'easeOutElastic',
        dur: 800,
      })
    })

    setTimeout(() => this.selectModel(newElement), 100)
  },

  setupModelSelector() {
    const modelGrid = document.getElementById('modelGrid')
    const prevButton = document.getElementById('prevPage')
    const nextButton = document.getElementById('nextPage')
    const pageIndicator = document.getElementById('pageIndicator')

    const renderPage = () => {
      modelGrid.innerHTML = ''

      const startIndex = this.currentPage * this.modelsPerPage
      const endIndex = Math.min(startIndex + this.modelsPerPage, this.modelTypes.length)
      const pageModels = this.modelTypes.slice(startIndex, endIndex)

      pageModels.forEach((model) => {
        const button = document.createElement('div')
        button.className = 'model-button'
        if (model.id === this.selectedModelId) {
          button.classList.add('selected')
        }
        button.setAttribute('data-model', model.id)
        button.textContent = model.name

        button.addEventListener('click', () => {
          document.querySelectorAll('.model-button').forEach((btn) => {
            btn.classList.remove('selected')
          })
          button.classList.add('selected')
          this.selectedModelId = model.id
        })

        modelGrid.appendChild(button)
      })

      pageIndicator.textContent = `${this.currentPage + 1}/${this.totalPages}`
      prevButton.classList.toggle('disabled', this.currentPage === 0)
      nextButton.classList.toggle('disabled', this.currentPage === this.totalPages - 1)
    }

    prevButton.addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--
        renderPage()
      }
    })

    nextButton.addEventListener('click', () => {
      if (this.currentPage < this.totalPages - 1) {
        this.currentPage++
        renderPage()
      }
    })

    renderPage()
  },

  setupControlButtons() {
    const deleteBtn = document.getElementById('deleteBtn')
    const lockBtn = document.getElementById('lockBtn')

    deleteBtn.addEventListener('click', () => {
      if (this.selectedModel) {
        this.deleteSelectedModel()
      }
    })

    lockBtn.addEventListener('click', () => {
      if (this.selectedModel) {
        this.toggleLock()
      }
    })

    this.updateControlButtons()
  },

  selectModel(model) {
    // Deselect previous model
    if (this.selectedModel) {
      this.selectedModel.setAttribute('animation__deselect', {
        property: 'scale',
        to: `${this.selectedModel.userData.currentScale} ${this.selectedModel.userData.currentScale} ${this.selectedModel.userData.currentScale}`,
        dur: 200,
        easing: 'easeOutQuad',
      })
    }

    // Select new model
    this.selectedModel = model
    const scale = model.userData.currentScale
    model.setAttribute('animation__select', {
      property: 'scale',
      to: `${scale * 1.1} ${scale * 1.1} ${scale * 1.1}`,
      dur: 200,
      easing: 'easeOutQuad',
    })

    this.updateControlButtons()
  },

  deleteSelectedModel() {
    if (!this.selectedModel) return

    const index = this.models.indexOf(this.selectedModel)
    if (index > -1) {
      this.models.splice(index, 1)
    }

    this.selectedModel.remove()
    this.selectedModel = null
    this.updateControlButtons()
  },

  toggleLock() {
    if (!this.selectedModel) return

    this.selectedModel.userData.isLocked = !this.selectedModel.userData.isLocked
    this.updateControlButtons()
  },

  updateControlButtons() {
    const deleteBtn = document.getElementById('deleteBtn')
    const lockBtn = document.getElementById('lockBtn')
    const controlButtons = document.getElementById('controlButtons')

    if (this.selectedModel) {
      controlButtons.style.display = 'flex'
      deleteBtn.classList.remove('disabled')
      lockBtn.classList.remove('disabled')

      lockBtn.textContent = this.selectedModel.userData.isLocked ? '🔒' : '🔓'
    } else {
      controlButtons.style.display = 'none'
    }
  },

  setupTouchHandlers() {
    const {sceneEl} = this.el

    sceneEl.addEventListener('touchstart', (e) => {
      if (!this.selectedModel || this.selectedModel.userData.isLocked) return

      if (e.touches.length === 2) {
        // Pinch zoom start
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        this.touchStartDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )
        this.initialScale = this.selectedModel.userData.currentScale
      } else if (e.touches.length === 1) {
        // Drag start
        this.isDragging = true
        this.dragStartPoint = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
      }
    })

    sceneEl.addEventListener('touchmove', (e) => {
      if (!this.selectedModel || this.selectedModel.userData.isLocked) return

      if (e.touches.length === 2) {
        // Pinch zoom - UNLIMITED ZOOM!
        e.preventDefault()
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )
        const scaleFactor = currentDistance / this.touchStartDistance
        const newScale = this.initialScale * scaleFactor

        // BỎ GIỚI HẠN ZOOM - có thể zoom tự do
        // Chỉ giữ giới hạn tối thiểu để tránh scale = 0
        const {baseScale} = this.selectedModel.userData
        const clampedScale = Math.max(baseScale * 0.001, newScale)  // Chỉ giới hạn tối thiểu

        this.selectedModel.userData.currentScale = clampedScale
        this.selectedModel.setAttribute('scale', `${clampedScale} ${clampedScale} ${clampedScale}`)
      } else if (e.touches.length === 1 && this.isDragging) {
        // Drag to move
        e.preventDefault()
        const camera = document.getElementById('camera')
        const touch = e.touches[0]

        const deltaX = (touch.clientX - this.dragStartPoint.x) * 0.01
        const deltaY = (touch.clientY - this.dragStartPoint.y) * 0.01

        // Get camera direction for movement
        const cameraDir = new THREE.Vector3()
        camera.object3D.getWorldDirection(cameraDir)
        cameraDir.y = 0
        cameraDir.normalize()

        // Calculate right vector
        const right = new THREE.Vector3()
        right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDir)

        // Get current position
        const currentPos = this.selectedModel.object3D.position.clone()

        // Apply movement
        const movement = new THREE.Vector3()
        movement.addScaledVector(right, deltaX)
        movement.addScaledVector(cameraDir, deltaY)

        currentPos.add(movement)
        this.selectedModel.setAttribute('position', currentPos)

        this.dragStartPoint = {
          x: touch.clientX,
          y: touch.clientY,
        }
      }
    })

    sceneEl.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.touchStartDistance = 0
      }
      if (e.touches.length === 0) {
        this.isDragging = false
        this.dragStartPoint = null
      }
    })
  },
}
