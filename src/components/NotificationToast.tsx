import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Clock } from 'lucide-react';
import { useEffect } from 'react';

export type NotificationType = 'success' | 'error';

interface NotificationToastProps {
  isVisible: boolean;
  type: NotificationType;
  title: string;
  message: string;
  onClose: () => void;
  timestamp?: string;
}

const NotificationToast = ({ isVisible, type, title, message, onClose, timestamp }: NotificationToastProps) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000); // Auto close after 6 seconds
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[60] w-full max-w-md"
        >
          <div 
            className={`
              rounded-lg shadow-2xl p-4 border-l-4 flex items-start gap-4 backdrop-blur-sm
              ${type === 'success' ? 'bg-white border-green-500 text-gray-800' : 'bg-white border-red-500 text-gray-800'}
            `}
            role="alert"
            aria-live="assertive"
          >
            <div className={`flex-shrink-0 mt-0.5 ${type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {type === 'success' ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <AlertCircle className="h-6 w-6" />
              )}
            </div>
            
            <div className="flex-grow">
              <h3 className={`font-bold text-base mb-1 ${type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {message}
              </p>
              {timestamp && (
                <p className="text-xs text-gray-400 mt-2 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {timestamp}
                </p>
              )}
            </div>

            <button 
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;
