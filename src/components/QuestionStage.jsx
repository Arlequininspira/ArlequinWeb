import './QuestionStage.css';

function QuestionStage({ onYes, onNo, isDarkMode }) {
  return (
    <div className={`question-stage ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <h2 className="question-text">
        ¿Conoces a<br/>Arlequín?
      </h2>
      <div className="question-buttons">
        <button 
          className="question-btn si-btn"
          onClick={onYes}
        >
          SÍ
        </button>
        <button 
          className="question-btn no-btn"
          onClick={onNo}
        >
          NO
        </button>
      </div>
    </div>
  );
}

export default QuestionStage;

