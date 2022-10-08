const closeSidebar = () => {
    const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
    sidebarEl.style.display = "none";
};

export default closeSidebar;
