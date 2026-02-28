// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};
