import Icon from "../components/Icon";
import "../less/loading.less";

function Loading() {
  return (
    <div className="page-wrapper loading">
      <div className="page-container">
        <Icon.Loader className="loading-icon" />
      </div>
    </div>
  );
}

export default Loading;
