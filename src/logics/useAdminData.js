import { useState, useEffect, useCallback } from 'react';

export function useAdminData() {
  const [quizzes, setQuizzes] = useState([]);
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('quizzes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showUploadQuestions, setShowUploadQuestions] = useState(false);
  const [showManageSections, setShowManageSections] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [assignGroupsQuiz, setAssignGroupsQuiz] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [quizzesRes, settingsRes] = await Promise.all([
        fetch('/api/admin/quizzes').then(r => r.json()),
        fetch('/api/admin/settings').then(r => r.json()),
      ]);
      if (Array.isArray(quizzesRes)) setQuizzes(quizzesRes);
    } catch (e) {
      setError('Failed to load data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadQuizDetails = useCallback(async (quizId) => {
    try {
      const [sectionsRes, questionsRes] = await Promise.all([
        fetch(`/api/admin/sections?quizId=${quizId}`).then(r => r.json()),
        fetch(`/api/admin/questions?quizId=${quizId}`).then(r => r.json()),
      ]);
      if (Array.isArray(sectionsRes)) setSections(sectionsRes);
      if (Array.isArray(questionsRes)) setQuestions(questionsRes);
    } catch (e) {
      setError('Failed to load quiz details');
    }
  }, []);

  const handleQuizSelect = useCallback((quiz) => {
    setSelectedQuiz(quiz);
    setActiveTab('questions');
    loadQuizDetails(quiz.id);
  }, [loadQuizDetails]);

  const handleCreateQuiz = useCallback((newQuiz) => {
    setQuizzes(prev => [newQuiz, ...prev]);
    setSelectedQuiz(newQuiz);
    setActiveTab('questions');
    loadQuizDetails(newQuiz.id);
  }, [loadQuizDetails]);

  const handleQuizUpdate = useCallback((updatedQuiz) => {
    setQuizzes(prev => prev.map(q => q.id === updatedQuiz.id ? updatedQuiz : q));
    if (selectedQuiz?.id === updatedQuiz.id) setSelectedQuiz(updatedQuiz);
  }, [selectedQuiz]);

  const handleQuizDelete = useCallback((quizId) => {
    setQuizzes(prev => prev.filter(q => q.id !== quizId));
    if (selectedQuiz?.id === quizId) {
      setSelectedQuiz(null);
      setActiveTab('quizzes');
      setSections([]);
      setQuestions([]);
    }
  }, [selectedQuiz]);

  const handleQuestionAdded = useCallback(() => {
    if (selectedQuiz) loadQuizDetails(selectedQuiz.id);
  }, [selectedQuiz, loadQuizDetails]);

  const handleQuestionUpdate = useCallback((updatedQuestion) => {
    setQuestions(prev => prev.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
  }, []);

  const handleQuestionDelete = useCallback((questionId) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  }, []);

  const handleSectionsChange = useCallback(() => {
    if (selectedQuiz) loadQuizDetails(selectedQuiz.id);
  }, [selectedQuiz, loadQuizDetails]);

  return {
    quizzes, sections, questions, activeTab, setActiveTab,
    loading, error, setError,
    selectedQuiz, setSelectedQuiz,
    showCreateQuiz, setShowCreateQuiz,
    showAddQuestion, setShowAddQuestion,
    showUploadQuestions, setShowUploadQuestions,
    showManageSections, setShowManageSections,
    showResponses, setShowResponses,
    selectedQuestion, setSelectedQuestion,
    assignGroupsQuiz, setAssignGroupsQuiz,
    loadQuizDetails,
    handleQuizSelect, handleCreateQuiz, handleQuizUpdate, handleQuizDelete,
    handleQuestionAdded, handleQuestionUpdate, handleQuestionDelete,
    handleSectionsChange,
  };
}