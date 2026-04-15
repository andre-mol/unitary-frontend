/**
 * DeleteConfirmModal - Confirmation modal for asset deletion
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { CustomItem } from '../../../../types';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    item: CustomItem | null;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    isOpen,
    item,
    onClose,
    onConfirm
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl"
                    >
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Excluir Ativo?</h3>
                            <p className="text-zinc-400 text-sm">
                                Esta ação removerá <strong>{item?.name}</strong> permanentemente do portfólio.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" className="w-full" onClick={onClose}>Cancelar</Button>
                            <button 
                                onClick={onConfirm}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

