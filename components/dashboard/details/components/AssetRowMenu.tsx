import React from 'react';
import { MoreHorizontal, Edit2, Trash2, LineChart, FileText } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '../../../ui/dropdown-menu';
import { CustomItem } from '../../../../types';

interface AssetRowMenuProps {
    item: CustomItem;
    onEdit: (item: CustomItem) => void;
    onDelete?: (item: CustomItem) => void; // Optional if we implement delete later
}

export const AssetRowMenu: React.FC<AssetRowMenuProps> = ({
    item,
    onEdit,
    onDelete
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md transition-colors data-[state=open]:text-white data-[state=open]:bg-zinc-800"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()} // Prevent row expansion
                >
                    <MoreHorizontal size={16} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-zinc-300">
                <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-wider">
                    {item.name}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />

                <DropdownMenuItem
                    className="cursor-pointer hover:bg-zinc-900 group text-xs focus:bg-zinc-900 focus:text-white"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onEdit(item); }}
                >
                    <Edit2 size={14} className="mr-2 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    Editar Ativo
                </DropdownMenuItem>

                <DropdownMenuItem
                    className="cursor-pointer hover:bg-zinc-900 group text-xs focus:bg-zinc-900 focus:text-white"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); /* Placeholder for details */ }}
                >
                    <LineChart size={14} className="mr-2 text-zinc-500 group-hover:text-indigo-500 transition-colors" />
                    Ver Gráficos
                </DropdownMenuItem>

                {/* 
                 <DropdownMenuItem 
                    className="cursor-pointer hover:bg-zinc-900 group text-xs focus:bg-zinc-900 focus:text-white"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); }}
                >
                     <FileText size={14} className="mr-2 text-zinc-500 group-hover:text-blue-500 transition-colors" />
                     Histórico
                </DropdownMenuItem> 
                */}

                {onDelete && (
                    <>
                        <DropdownMenuSeparator className="bg-zinc-800" />
                        <DropdownMenuItem
                            className="cursor-pointer hover:bg-red-900/20 group text-xs text-red-400 focus:bg-red-900/20 focus:text-red-300"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(item); }}
                        >
                            <Trash2 size={14} className="mr-2 text-red-500 group-hover:text-red-400" />
                            Excluir Ativo
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
