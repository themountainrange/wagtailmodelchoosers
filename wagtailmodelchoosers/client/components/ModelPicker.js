import PropTypes from 'prop-types';
import React from 'react';
import Button, { CloseButton } from './Buttons';
import AutoComplete from './AutoComplete';
import { pluralize, tr } from '../utils';

const MODAL_EXIT_CLASS = 'admin-modal--exit';
const MODAL_CLOSE_TIMEOUT = 400;
const MODAL_OPEN_TIMEOUT = 650;

const STR = {
  choose: 'Choose',
  result: 'Result',
  results: 'Results',
  previous: 'Previous',
  page: 'Page',
  pages: 'Pages',
  next: 'Next',
};

const defaultProps = {
  display: 'title',
  filters: [],
  pk_name: 'uuid',
  page_size: 10,
  page_size_param: 'page_size',
  translations: {},
};

const propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  endpoint: PropTypes.string.isRequired,
  createEndpoint: PropTypes.string.isRequired,
  value: PropTypes.any,
  required: PropTypes.bool.isRequired,
  display: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  list_display: PropTypes.array.isRequired,
  filters: PropTypes.array,
  pk_name: PropTypes.string.isRequired,
  page_size: PropTypes.number,
  page_size_param: PropTypes.string,
  translations: PropTypes.object,
};

class ModelPicker extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      pickerVisible: false,
      loading: true,
      next: false,
      previous: false,
      count: 0,
      url: null,
      numPages: 0,
      page: 0,
      suggestions: [],
      loadingSuggestions: false,
    };

    this.getDefaultUrl = this.getDefaultUrl.bind(this);
    this.getPk = this.getPk.bind(this);
    this.getModels = this.getModels.bind(this);
    this.select = this.select.bind(this);
    this.closeWithCallback = this.closeWithCallback.bind(this);
    this.update = this.update.bind(this);
    this.addFilterParams = this.addFilterParams.bind(this);
    this.navigate = this.navigate.bind(this);
    this.onClose = this.onClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.getPlaceholder = this.getPlaceholder.bind(this);
    this.getTable = this.getTable.bind(this);
    this.getHeader = this.getHeader.bind(this);
    this.parseValue = this.parseValue.bind(this);
    this.getRow = this.getRow.bind(this);
    this.getCount = this.getCount.bind(this);
    this.popupCreateLink = this.popupCreateLink.bind(this);
    this.getCountDisplay = this.getCountDisplay.bind(this);
    this.getPageDisplay = this.getPageDisplay.bind(this);
    this.getPaginationButtons = this.getPaginationButtons.bind(this);
    this.navigatePrevious = this.navigatePrevious.bind(this);
    this.navigateNext = this.navigateNext.bind(this);
    this.onLoadSuggestions = this.onLoadSuggestions.bind(this);
    this.onValueChange = this.onValueChange.bind(this);
    this.onClearSearch = this.onClearSearch.bind(this);
    this.onLoadStart = this.onLoadStart.bind(this);
  }

  getDefaultUrl() {
    const { endpoint, page_size: pageSize, page_size_param: pageSizeParam } = this.props;
    return `${endpoint}/?${pageSizeParam}=${pageSize}`;
  }

  componentDidMount() {
    setTimeout(() => {
      this.navigate(this.getDefaultUrl());
    }, MODAL_OPEN_TIMEOUT);

    document.body.style.overflow = 'hidden';
    document.body.style.width = `${document.body.offsetWidth}px`;
  }

  componentWillUnmount() {
    document.body.style.overflow = '';
    document.body.style.width = '';
  }

  getPk(item) {
    const { pk_name } = this.props;

    return !!item ? item[pk_name] : null;
  }

  getModels() {
    return this.state.suggestions;
  }

  select(pk) {
    const { onSelect } = this.props;
    const { url } = this.state;
    const models = this.getModels();
    const item = models.find(m => this.getPk(m) === pk);

    this.closeWithCallback(() => {
      onSelect(this.getPk(item), item, url);
    });
  }

  closeWithCallback(callback) {
    this.elRef.classList.add(MODAL_EXIT_CLASS);
    setTimeout(callback, MODAL_CLOSE_TIMEOUT);
  }

  update(json) {
    const { page_size: pageSize } = this.props;

    // If the API does not return the total number of page,
    // try to calculate it from the number of result and the page size.
    let numPage = 0;
    if (json.num_pages) {
      numPage = json.num_pages;
    } else if (json.count) {
      numPage = Math.ceil(json.count / pageSize);
    }

    this.setState({
      numPages: numPage,
      page: json.page,
      suggestions: json.results,
      count: json.count,
      next: json.next,
      previous: json.previous,
      loading: false,
    }, () => {
      this.contentRef.scrollTop = 0;
    });
  }

  addFilterParams(url) {
    const { filters } = this.props;
    let localUrl = url;

    if (filters) {
      // TODO Redo with map and join.
      filters.forEach((filter) => {
        localUrl += `&${filter.field}=${filter.value}`;
      });
    }

    return localUrl;
  }

  navigate(url) {
    const urlWithFilters = this.addFilterParams(url);
    this.setState({
      loading: true,
      url: url,
    }, () => {
      // TODO There is no reason for this code to be in the setState callback.
      // TODO This is not producing errors when status code is not 200,
      // so the error handling likely does not work.
      // TODO Use fetch API wrapper.
      fetch(urlWithFilters, {
        credentials: 'same-origin',
      })
        .then(res => res.json())
        .then(this.update, this.handleError);
    });
  }

  onClose(e) {
    const { onClose } = this.props;
    this.closeWithCallback(() => {
      onClose(e);
    });
  }

  handleError() {
    this.setState({
      loading: false,
    });
  }

  getPlaceholder() {
    const { list_display: listDisplay } = this.props;
    const { loading } = this.state;

    return (
      <tr className="chooser__item">
        <td colSpan={listDisplay.length} className="chooser__cell chooser__cell--disabled">
          {loading ? 'Loading' : 'Sorry, no results'}
        </td>
      </tr>
    );
  }

  getTable() {
    const { list_display: listDisplay } = this.props;
    const models = this.getModels();

    return (
      <table className="chooser-table">
        <thead>
        <tr>
          {listDisplay.map(this.getHeader)}
        </tr>
        </thead>
        <tbody>
        {models.length ? models.map(this.getRow) : this.getPlaceholder()}
        </tbody>
      </table>
    );
  }

  getHeader(field) {
    return (
      <td key={field.name}>
        {field.label}
      </td>
    );
  }

  parseValue(value, fieldName) {
    const type = typeof value;

    if (type === 'string') {
      return value;
    }

    if (type === 'number') {
      return value;
    }

    if (type === 'object') {
      // Django internals
      if (fieldName === 'content_type') {
        return value.model;
      }
    }

    if (type === 'boolean') {
      return value ? 'True' : 'False';
    }

    return '';
  }

  getRow(item) {
    const { list_display: listDisplay } = this.props;

    return (
      <tr
        key={this.getPk(item)}
        className="chooser__item"
        onClick={() => this.select(this.getPk(item))}
      >
        {listDisplay.map(field => {
          const value = item[field.name];

          return (
            <td key={field.name} className="chooser__cell">
              {this.parseValue(value, field.name)}
            </td>
          );
        })}
      </tr>
    );
  }

  popupCreateLink(event) {
    event.preventDefault();
    window.open(this.props.createEndpoint, 'createModelInstance', 'width=900,height=600,resizable=yes,scrollbars=yes');
  }

  getCreateLink() {
    if (this.props.createEndpoint) {
      return (
        <a
          href={this.props.createEndpoint}
          onClick={this.popupCreateLink}
          className="admin-modal__create_link button"
        >
          Create New
        </a>
      );
    }
  }

  getCount() {
    return this.state.count;
  }

  getCountDisplay() {
    const { translations } = this.props;
    const count = this.getCount();
    const label = pluralize(STR, translations, 'result', 'results', count);

    return (
      <span className="admin-modal__results">
        {count} {label}
      </span>
    );
  }

  getPageDisplay() {
    const { translations } = this.props;
    const { numPages, page: currentPage } = this.state;

    const label = pluralize(STR, translations, 'result', 'results', numPages);
    const text = `${currentPage} / ${numPages} ${label}`;

    return <span className="admin-modal__pagination">{text}</span>;
  }

  getPaginationButtons() {
    const { translations } = this.props;
    const { next, previous } = this.state;

    const prevLabel = tr(STR, translations, 'previous');
    const nextLabel = tr(STR, translations, 'next');
    const prevEnabled = !!previous;
    const nextEnabled = !!next;

    return (
      <span>
        <Button
          onClick={this.navigatePrevious}
          isActive={prevEnabled}
          label={prevLabel}
        />
        <Button
          onClick={this.navigateNext}
          isActive={nextEnabled}
          label={nextLabel}
        />
      </span>
    );
  }

  navigatePrevious() {
    const { previous, page } = this.state;

    if (previous) {
      this.navigate(previous);
    } else {
      const url = `${this.getDefaultUrl()}&page=${page - 1}`;
      this.navigate(url);
    }
  }

  navigateNext() {
    const { next, page } = this.state;

    if (next) {
      this.navigate(next);
    } else {
      const url = `${this.getDefaultUrl()}&page=${page + 1}`;
      this.navigate(url);
    }
  }

  onLoadSuggestions(json) {
    this.setState({
      suggestions: json.results,
      next: json.next,
      previous: json.previous,
      page: json.page,
      count: json.count,
      numPages: json.num_pages,
      loadingSuggestions: false,
    });
  }

  onValueChange() {

  }

  onClearSearch() {
    this.setState({
      next: null,
      previous: null,
      page: 0,
      numPages: 0,
      count: 0,
      suggestions: [],
    });
    this.navigate(this.getDefaultUrl());
  }
  onLoadStart() {
    this.setState({
      loadingSuggestions: true,
    });
  }

  render() {
    const { endpoint, label, translations } = this.props;
    const chooseHeading = tr(STR, translations, 'choose');

    return (
      <div className="modal admin-modal" ref={(el) => { this.elRef = el; }}>
        <div className="admin-modal__dialog">
          <div className="admin-modal__header">
            <h2>{chooseHeading} {label}</h2>
            <CloseButton onClick={this.onClose} />
          </div>
          <div className="admin-modal__actions">
            <div className="admin-modal__action">
              <AutoComplete
                onChange={this.onValueChange}
                onLoadSuggestions={this.onLoadSuggestions}
                onLoadStart={this.onLoadStart}
                onClearSearch={this.onClearSearch}
                endpoint={endpoint}
                filter={this.addFilterParams('')}
              />
            </div>
            <div className="admin-modal__action">
              {this.getCreateLink()}
              {this.getCountDisplay()}
              {this.getPageDisplay()}
              {this.getPaginationButtons()}
            </div>
          </div>
          <div className="admin-modal__content" ref={(content) => { this.contentRef = content; }}>
            {this.getTable()}
          </div>
        </div>
      </div>
    );
  }
}

ModelPicker.defaultProps = defaultProps;
ModelPicker.propTypes = propTypes;

export default ModelPicker;
