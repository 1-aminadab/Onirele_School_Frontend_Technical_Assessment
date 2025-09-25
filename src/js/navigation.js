export class Navigation {
    constructor() {
        this.currentSection = null;
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.intersectionObserver = null;
        this.abortController = new AbortController();
        
        this.nav = document.querySelector('.nav');
        this.navToggle = document.querySelector('.nav-toggle');
        this.navList = document.querySelector('.nav-list');
        this.sections = document.querySelectorAll('.content-section');
        this.navLinks = document.querySelectorAll('.nav-link');
        
        if (!this.nav || !this.navToggle || !this.navList) {
            console.warn('Navigation elements not found');
            return;
        }
        
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupScrollHandling();
        this.setupNavigationHandling();
        this.setupMobileMenu();
        this.setupKeyboardNavigation();
        this.makeNavSticky();
    }

    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '-20% 0px -80% 0px',
            threshold: 0
        };

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.updateActiveNavLink(entry.target.id);
                    this.currentSection = entry.target.id;
                }
            });
        }, options);

        this.sections.forEach(section => {
            this.intersectionObserver.observe(section);
        });
    }

    updateActiveNavLink(activeId) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            link.setAttribute('aria-current', 'false');
            
            if (link.getAttribute('href') === `#${activeId}`) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    setupScrollHandling() {
        let ticking = false;
        
        const handleScroll = () => {
            if (!ticking && !this.isScrolling) {
                requestAnimationFrame(() => {
                    this.handleScrollEffects();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, {
            passive: true,
            signal: this.abortController.signal
        });
    }

    handleScrollEffects() {
        const scrollY = window.scrollY;
        
        if (scrollY > 100) {
            this.nav.classList.add('nav-scrolled');
        } else {
            this.nav.classList.remove('nav-scrolled');
        }
    }

    setupNavigationHandling() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavClick(link);
            }, { signal: this.abortController.signal });
        });
    }

    handleNavClick(link) {
        const targetId = link.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        
        if (!targetSection) return;

        this.isScrolling = true;
        this.closeMobileMenu();
        
        clearTimeout(this.scrollTimeout);
        
        const headerHeight = this.nav.offsetHeight;
        const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });

        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 1000);
    }

    setupMobileMenu() {
        this.navToggle.addEventListener('click', () => {
            this.toggleMobileMenu();
        }, { signal: this.abortController.signal });

        document.addEventListener('click', (e) => {
            if (!this.nav.contains(e.target) && this.navList.classList.contains('nav-list-open')) {
                this.closeMobileMenu();
            }
        }, { signal: this.abortController.signal });
    }

    toggleMobileMenu() {
        const isOpen = this.navList.classList.contains('nav-list-open');
        
        if (isOpen) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }

    openMobileMenu() {
        this.navList.classList.add('nav-list-open');
        this.navToggle.classList.add('nav-toggle-open');
        this.navToggle.setAttribute('aria-expanded', 'true');
        
        const firstLink = this.navList.querySelector('.nav-link');
        if (firstLink) firstLink.focus();
    }

    closeMobileMenu() {
        this.navList.classList.remove('nav-list-open');
        this.navToggle.classList.remove('nav-toggle-open');
        this.navToggle.setAttribute('aria-expanded', 'false');
    }

    setupKeyboardNavigation() {
        this.navToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleMobileMenu();
            }
        }, { signal: this.abortController.signal });

        this.navLinks.forEach(link => {
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleNavClick(link);
                }
            }, { signal: this.abortController.signal });
        });
    }

    makeNavSticky() {
        this.nav.classList.add('nav-sticky');
    }

    destroy() {
        this.abortController.abort();
        
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        clearTimeout(this.scrollTimeout);
        
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            link.setAttribute('aria-current', 'false');
        });
    }
}
