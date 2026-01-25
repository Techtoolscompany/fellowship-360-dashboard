'use client'
import { useEffect } from 'react'

const useBootstrapUtils = (pathName) => {
    useEffect(() => {
        import('bootstrap/dist/js/bootstrap.bundle.min')
        
        let handleResize;

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            tooltip()
            handleResize = () => {
                const newWindowWidth = window.innerWidth;
                if (newWindowWidth >= 1400) {
                    document.querySelectorAll(".dropdown").forEach((e) => {
                        e.addEventListener("mouseover", () => {
                            e.querySelector(".dropdown-menu")?.classList.add("show")
                        })
                        e.addEventListener("mouseleave", () => {
                            e.querySelector(".dropdown-menu")?.classList.remove("show")
                        })
                    })
                }
            };

            window.addEventListener('resize', handleResize);
            handleResize();
        }

    }, [pathName]);
};

export default useBootstrapUtils;

function tooltip() {

    let tooltip = document.querySelector('.custom-tooltip');
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = 'custom-tooltip';
        document.body.appendChild(tooltip);
    }

    // Select all elements with the `data-bs-toggle="tooltip"` attribute
    const tooltipElements = document.querySelectorAll('[data-toggle="tooltip"]');

    tooltipElements.forEach((element) => {
        // Show tooltip on mouseenter
        element.addEventListener("mousemove", (e) => {
            positionTooltip(element, tooltip);
            const title = element.getAttribute("data-title");
            if (title) {
                tooltip.textContent = title;
                tooltip.style.opacity = "1";
                tooltip.style.display = "block";
            }
        });

        // Hide tooltip on mouseleave
        element.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            tooltip.style.display = "none";
        });
    });
}

function positionTooltip(element, tooltip) {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default position: top
    let top = rect.top - tooltipRect.height - 10; // 10px offset
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2); // Center horizontally

    // Check if there's enough space at the top
    if (top < 0) {
        // Not enough space at the top, place at the bottom
        top = rect.bottom + 10;
    }

    // Check if there's enough space on the right
    if (left + tooltipRect.width > viewportWidth) {
        // Not enough space on the right, place on the left
        left = rect.left - tooltipRect.width - 10;
    }

    // Check if there's enough space on the left
    if (left < 0) {
        // Not enough space on the left, place on the right
        left = rect.right + 10;
    }

    // Apply calculated position
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}