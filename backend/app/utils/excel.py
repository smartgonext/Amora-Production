"""
Excel Import/Export Utility — Using openpyxl
Provides functions to export data to Excel and import data from Excel templates.
"""
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from datetime import datetime


def export_to_excel(data, filename="export.xlsx", sheet_name="Data", headers=None):
    """
    Export data to Excel file.
    
    Args:
        data (list): List of dictionaries or list of lists
        filename (str): Output filename
        sheet_name (str): Sheet name
        headers (list): Optional custom headers
    
    Returns:
        BytesIO: Excel file buffer
    """
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    
    # Styling
    header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='2D3748', end_color='2D3748', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    cell_font = Font(name='Arial', size=10, color='4A5568')
    cell_alignment = Alignment(horizontal='left', vertical='center')
    
    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )
    
    if data and len(data) > 0:
        # Extract headers
        if headers:
            header_row = headers
        elif isinstance(data[0], dict):
            header_row = list(data[0].keys())
        else:
            header_row = [f"Column {i+1}" for i in range(len(data[0]))]
        
        # Write headers
        for col_num, header in enumerate(header_row, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.value = header
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = border_thin
        
        # Write data rows
        for row_num, row_data in enumerate(data, 2):
            if isinstance(row_data, dict):
                for col_num, header in enumerate(header_row, 1):
                    cell = ws.cell(row=row_num, column=col_num)
                    cell.value = row_data.get(header, '')
                    cell.font = cell_font
                    cell.alignment = cell_alignment
                    cell.border = border_thin
            else:
                for col_num, value in enumerate(row_data, 1):
                    cell = ws.cell(row=row_num, column=col_num)
                    cell.value = value
                    cell.font = cell_font
                    cell.alignment = cell_alignment
                    cell.border = border_thin
        
        # Auto-adjust column widths
        for col_num in range(1, len(header_row) + 1):
            column_letter = get_column_letter(col_num)
            max_length = 0
            for row in ws[column_letter]:
                try:
                    if len(str(row.value)) > max_length:
                        max_length = len(str(row.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def import_from_excel(file_buffer, sheet_name=None, has_header=True):
    """
    Import data from Excel file.
    
    Args:
        file_buffer (BytesIO): Excel file buffer
        sheet_name (str): Sheet name (uses first sheet if None)
        has_header (bool): Whether first row is header
    
    Returns:
        list: List of dictionaries (if has_header) or list of lists
    """
    wb = load_workbook(file_buffer, read_only=True, data_only=True)
    
    if sheet_name:
        ws = wb[sheet_name]
    else:
        ws = wb.active
    
    rows = list(ws.rows)
    
    if not rows:
        return []
    
    if has_header:
        headers = [cell.value for cell in rows[0]]
        data = []
        for row in rows[1:]:
            row_dict = {}
            for idx, cell in enumerate(row):
                if idx < len(headers):
                    row_dict[headers[idx]] = cell.value
            data.append(row_dict)
        return data
    else:
        return [[cell.value for cell in row] for row in rows]


def create_excel_template(headers, filename="template.xlsx", sheet_name="Template", example_row=None):
    """
    Create an Excel template for bulk import.
    
    Args:
        headers (list): Column headers
        filename (str): Output filename
        sheet_name (str): Sheet name
        example_row (dict): Optional example data row
    
    Returns:
        BytesIO: Excel file buffer
    """
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    
    # Styling
    header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='2D3748', end_color='2D3748', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    example_font = Font(name='Arial', size=10, color='718096', italic=True)
    example_fill = PatternFill(start_color='F7FAFC', end_color='F7FAFC', fill_type='solid')
    
    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )
    
    # Write headers
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num)
        cell.value = header
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = border_thin
    
    # Write example row if provided
    if example_row:
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=2, column=col_num)
            cell.value = example_row.get(header, '')
            cell.font = example_font
            cell.fill = example_fill
            cell.border = border_thin
    
    # Auto-adjust column widths
    for col_num in range(1, len(headers) + 1):
        column_letter = get_column_letter(col_num)
        ws.column_dimensions[column_letter].width = 20
    
    # Add instructions
    ws2 = wb.create_sheet(title="Instructions")
    ws2['A1'] = "Import Instructions"
    ws2['A1'].font = Font(name='Arial', size=14, bold=True)
    ws2['A3'] = "1. Fill in the data starting from row 2 (or row 3 if example row is present)"
    ws2['A4'] = "2. Do not modify the header row"
    ws2['A5'] = "3. Save the file and upload it through the import screen"
    ws2['A6'] = f"4. Template generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    # Save to buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def export_report_to_excel(report_data, report_title="Report", summary_data=None):
    """
    Export a report to Excel with formatting and optional summary.
    
    Args:
        report_data (list): List of dictionaries containing report rows
        report_title (str): Title of the report
        summary_data (dict): Optional summary statistics
    
    Returns:
        BytesIO: Excel file buffer
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    
    # Title styling
    title_font = Font(name='Arial', size=16, bold=True, color='1A202C')
    title_alignment = Alignment(horizontal='left', vertical='center')
    
    # Add title
    ws['A1'] = report_title
    ws['A1'].font = title_font
    ws['A1'].alignment = title_alignment
    ws.merge_cells('A1:E1')
    
    # Add generation timestamp
    ws['A2'] = f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    ws['A2'].font = Font(name='Arial', size=9, color='718096')
    
    # Add summary if provided
    start_row = 4
    if summary_data:
        ws[f'A{start_row}'] = "Summary"
        ws[f'A{start_row}'].font = Font(name='Arial', size=12, bold=True)
        start_row += 1
        
        for key, value in summary_data.items():
            ws[f'A{start_row}'] = key
            ws[f'B{start_row}'] = value
            ws[f'A{start_row}'].font = Font(name='Arial', size=10, bold=True)
            ws[f'B{start_row}'].font = Font(name='Arial', size=10)
            start_row += 1
        
        start_row += 2
    
    # Add data table
    if report_data and len(report_data) > 0:
        headers = list(report_data[0].keys())
        
        # Header styling
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='2D3748', end_color='2D3748', fill_type='solid')
        
        # Write headers
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row, column=col_num)
            cell.value = header
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')
        
        # Write data
        for row_num, row_data in enumerate(report_data, start_row + 1):
            for col_num, header in enumerate(headers, 1):
                cell = ws.cell(row=row_num, column=col_num)
                cell.value = row_data.get(header, '')
                cell.font = Font(name='Arial', size=10, color='4A5568')
                
                # Alternate row colors
                if row_num % 2 == 0:
                    cell.fill = PatternFill(start_color='F7FAFC', end_color='F7FAFC', fill_type='solid')
        
        # Auto-adjust columns
        for col_num in range(1, len(headers) + 1):
            column_letter = get_column_letter(col_num)
            ws.column_dimensions[column_letter].width = 18
    
    # Save to buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
